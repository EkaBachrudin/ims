import { endOfDay, format, startOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { getReceiptStatus } from "../purchase-orders/purchase-orders.service";
import { resolveProduct, searchProducts } from "../products/product-resolver";

export async function stockReport(query: {
  q?: string;
  categoryId?: number;
  warehouseId?: string;
}) {
  const products = await prisma.product.findMany({
    where: {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { sku: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true } },
      inventories: query.warehouseId
        ? {
            where: { warehouseId: query.warehouseId },
            include: { warehouse: { select: { id: true, code: true, name: true } } },
          }
        : { include: { warehouse: { select: { id: true, code: true, name: true } } } },
    },
  });

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    stock: p.stock,
    minStock: p.minStock,
    category: p.category,
    lowStock: p.stock <= p.minStock,
    inventories: p.inventories,
  }));
}

export interface StockProduct {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  category: { id: number; name: string } | null;
}

export interface StockLookupResult {
  status: "ok" | "ambiguous" | "none";
  product: StockProduct | null;
  candidates: StockProduct[];
  suggestions: { name: string; sku: string }[];
}

function toStockProduct(p: {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  category: { id: number; name: string } | null;
}): StockProduct {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    stock: p.stock,
    minStock: p.minStock,
    category: p.category,
  };
}

const stockProductInclude = { category: { select: { id: true, name: true } } } as const;

/**
 * Lookup stok berdasarkan nama bebas. Mengembalikan status eksplisit agar
 * kandidat (ambiguous) maupun saran (none) tidak hilang menjadi null.
 */
export async function findStockByProductName(productName: string): Promise<StockLookupResult> {
  const match = await resolveProduct(productName);

  if (match.status === "ok") {
    const product = await prisma.product.findUnique({
      where: { id: match.product.id },
      include: stockProductInclude,
    });
    if (!product) return { status: "none", product: null, candidates: [], suggestions: [] };
    return { status: "ok", product: toStockProduct(product), candidates: [], suggestions: [] };
  }

  if (match.status === "ambiguous") {
    const candidates = await prisma.product.findMany({
      where: { id: { in: match.candidates.map((c) => c.id) } },
      orderBy: { name: "asc" },
      include: stockProductInclude,
    });
    return {
      status: "ambiguous",
      product: null,
      candidates: candidates.map(toStockProduct),
      suggestions: [],
    };
  }

  return {
    status: "none",
    product: null,
    candidates: [],
    suggestions: match.suggestions.map((s) => ({ name: s.name, sku: s.sku })),
  };
}

export async function shipmentRecap(dateInput: string) {
  // Interpretasikan YYYY-MM-DD sebagai tanggal lokal (hindari pergeseran timezone).
  const parts = dateInput ? dateInput.split("-").map(Number) : [];
  const [y, m, d] = parts;
  const date = parts.length === 3 && y && m && d ? new Date(y, m - 1, d) : new Date();
  const from = startOfDay(date);
  const to = endOfDay(date);

  const rows = await prisma.stockTransaction.findMany({
    where: { type: "OUT", createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { name: true, unit: true, sku: true } },
      partner: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });

  return {
    date: format(date, "yyyy-MM-dd"),
    shipments: rows.map((r) => ({
      partner: r.partner?.name ?? "-",
      product: r.product.name,
      sku: r.product.sku,
      qty: r.quantity,
      unit: r.product.unit,
      warehouse: r.warehouse.name,
      notes: r.notes,
    })),
  };
}

export async function lowStock() {
  const products = await prisma.product.findMany({
    orderBy: { stock: "asc" },
    include: { category: { select: { id: true, name: true } } },
  });
  return products
    .filter((p) => p.stock <= p.minStock)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stock: p.stock,
      minStock: p.minStock,
      category: p.category,
    }));
}

export async function dashboard() {
  const now = new Date();
  const from = startOfDay(now);
  const to = endOfDay(now);

  const [totalProducts, activePOs, todayInbound, todayOutbound, lowStockRows] = await Promise.all([
    prisma.product.count(),
    prisma.purchaseOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } }),
    prisma.stockTransaction.count({ where: { type: "IN", createdAt: { gte: from, lte: to } } }),
    prisma.stockTransaction.count({ where: { type: "OUT", createdAt: { gte: from, lte: to } } }),
    prisma.product.findMany({ orderBy: { stock: "asc" } }),
  ]);

  const recentTransactions = await prisma.stockTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return {
    totalProducts,
    activePOs,
    todayInbound,
    todayOutbound,
    lowStockCount: lowStockRows.filter((p) => p.stock <= p.minStock).length,
    recentTransactions,
  };
}

// ----------------------------------------------------------------------
// Endpoint baca untuk AI Agent (pencarian berbasis nama, output ramah AI)
// ----------------------------------------------------------------------

/** Interpretasikan YYYY-MM-DD sebagai tanggal lokal, hindari pergeseran timezone. */
function parseLocalDate(input: string): Date {
  const parts = input.split("-").map(Number);
  const [y, m, d] = parts;
  if (parts.length === 3 && y && m && d) return new Date(y, m - 1, d);
  return new Date(input);
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter {
  const filter: Prisma.DateTimeFilter = {};
  if (from) filter.gte = startOfDay(parseLocalDate(from));
  if (to) filter.lte = endOfDay(parseLocalDate(to));
  return filter;
}

const insensitive = (value: string) => ({ contains: value, mode: "insensitive" as const });

export async function productCatalog(query: {
  q?: string;
  categoryId?: number;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);
  const matchedIds = query.q ? (await searchProducts(query.q)).map((p) => p.id) : null;
  const where: Prisma.ProductWhereInput = {
    ...(matchedIds ? { id: { in: matchedIds } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    rows: rows.map((p) => ({
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stock: p.stock,
      minStock: p.minStock,
      category: p.category?.name ?? null,
      lowStock: p.stock <= p.minStock,
    })),
    meta: buildMeta(page, limit, total),
  };
}

export async function categoryCatalog(query: { q?: string }) {
  const rows = await prisma.category.findMany({
    where: query.q ? { name: insensitive(query.q) } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
}

export async function partnerCatalog(query: {
  q?: string;
  type?: "SUPPLIER" | "CUSTOMER";
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where: Prisma.PartnerWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.q ? { OR: [{ name: insensitive(query.q) }, { phone: insensitive(query.q) }] } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.partner.findMany({ where, orderBy: { name: "asc" }, skip, take }),
    prisma.partner.count({ where }),
  ]);

  return {
    rows: rows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      phone: p.phone,
      email: p.email,
      address: p.address,
    })),
    meta: buildMeta(page, limit, total),
  };
}

export async function warehouseCatalog(query: { q?: string }) {
  const rows = await prisma.warehouse.findMany({
    where: query.q ? { OR: [{ name: insensitive(query.q) }, { code: insensitive(query.q) }] } : {},
    orderBy: { code: "asc" },
  });
  return rows.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    address: w.address,
    isActive: w.isActive,
  }));
}

export async function inventoryReport(query: {
  productName?: string;
  warehouseCode?: string;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);
  const matchedProductIds = query.productName
    ? (await searchProducts(query.productName)).map((p) => p.id)
    : null;
  const where: Prisma.InventoryWhereInput = {
    ...(matchedProductIds ? { productId: { in: matchedProductIds } } : {}),
    ...(query.warehouseCode
      ? {
          warehouse: {
            OR: [
              { code: insensitive(query.warehouseCode) },
              { name: insensitive(query.warehouseCode) },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      include: {
        product: { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      product: r.product.name,
      sku: r.product.sku,
      unit: r.product.unit,
      warehouse: r.warehouse.name,
      warehouseCode: r.warehouse.code,
      quantity: r.quantity,
    })),
    meta: buildMeta(page, limit, total),
  };
}

export async function transactionListReport(query: {
  type?: "IN" | "OUT" | "ADJUSTMENT";
  from?: string;
  to?: string;
  productName?: string;
  warehouseCode?: string;
  partnerName?: string;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);

  const [products, warehouses, partners] = await Promise.all([
    query.productName ? searchProducts(query.productName) : [],
    query.warehouseCode
      ? prisma.warehouse.findMany({
          where: {
            OR: [
              { code: insensitive(query.warehouseCode) },
              { name: insensitive(query.warehouseCode) },
            ],
          },
          orderBy: { code: "asc" },
          select: { id: true, name: true },
        })
      : [],
    query.partnerName
      ? prisma.partner.findMany({
          where: { name: insensitive(query.partnerName) },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const unmatched: string[] = [];
  if (query.productName && products.length === 0) unmatched.push(`produk "${query.productName}"`);
  if (query.warehouseCode && warehouses.length === 0)
    unmatched.push(`gudang "${query.warehouseCode}"`);
  if (query.partnerName && partners.length === 0) unmatched.push(`partner "${query.partnerName}"`);
  const matched = {
    products: products.map((p) => p.name),
    warehouses: warehouses.map((w) => w.name),
    partners: partners.map((p) => p.name),
  };
  if (unmatched.length > 0)
    return { rows: [], meta: buildMeta(page, limit, 0), unmatched, matched };

  const createdAt = dateRange(query.from, query.to);
  const where: Prisma.StockTransactionWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(products.length ? { productId: { in: products.map((p) => p.id) } } : {}),
    ...(warehouses.length ? { warehouseId: { in: warehouses.map((w) => w.id) } } : {}),
    ...(partners.length ? { partnerId: { in: partners.map((p) => p.id) } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        product: { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
        partner: { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } },
        deliveryNote: { select: { dnNumber: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.stockTransaction.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      date: format(r.createdAt, "yyyy-MM-dd HH:mm"),
      type: r.type,
      product: r.product.name,
      sku: r.product.sku,
      quantity: r.quantity,
      unit: r.product.unit,
      warehouse: r.warehouse.name,
      partner: r.partner?.name ?? null,
      poNumber: r.purchaseOrder?.poNumber ?? null,
      dnNumber: r.deliveryNote?.dnNumber ?? null,
      notes: r.notes,
      createdBy: r.createdBy.name,
    })),
    meta: buildMeta(page, limit, total),
    unmatched,
    matched,
  };
}

const poIncludeReport = {
  partner: { select: { name: true, type: true } },
  warehouse: { select: { code: true, name: true } },
  items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
} as const;

type PoStatus = "DRAFT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export async function purchaseOrderListReport(query: {
  status?: PoStatus;
  statuses?: PoStatus[];
  partnerName?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);

  const partners = query.partnerName
    ? await prisma.partner.findMany({
        where: { name: insensitive(query.partnerName) },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const unmatched: string[] = [];
  if (query.partnerName && partners.length === 0) unmatched.push(`partner "${query.partnerName}"`);
  const matched = { partners: partners.map((p) => p.name) };
  if (unmatched.length > 0)
    return { rows: [], meta: buildMeta(page, limit, 0), unmatched, matched };

  const createdAt = dateRange(query.from, query.to);
  const statusWhere: Prisma.PurchaseOrderWhereInput = query.status
    ? { status: query.status }
    : query.statuses?.length
      ? { status: { in: query.statuses } }
      : {};
  const where: Prisma.PurchaseOrderWhereInput = {
    ...statusWhere,
    ...(partners.length ? { partnerId: { in: partners.map((p) => p.id) } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: poIncludeReport,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    rows: rows.map((po) => ({
      poNumber: po.poNumber,
      status: po.status,
      source: po.source,
      partner: po.partner.name,
      warehouse: po.warehouse?.name ?? null,
      targetDate: po.targetDate ? format(po.targetDate, "yyyy-MM-dd") : null,
      createdAt: format(po.createdAt, "yyyy-MM-dd HH:mm"),
      items: po.items.map((i) => ({
        product: i.product.name,
        sku: i.product.sku,
        quantity: i.quantity,
        unit: i.product.unit,
      })),
    })),
    meta: buildMeta(page, limit, total),
    unmatched,
    matched,
  };
}

export async function purchaseOrderDetailReport(poNumber: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { equals: poNumber, mode: "insensitive" } },
    include: poIncludeReport,
  });
  if (!po) return null;

  const lines = await getReceiptStatus(prisma, po.id);
  const byProduct = new Map(lines.map((l) => [l.productId, l]));

  return {
    poNumber: po.poNumber,
    status: po.status,
    source: po.source,
    partner: po.partner.name,
    warehouse: po.warehouse?.name ?? null,
    targetDate: po.targetDate ? format(po.targetDate, "yyyy-MM-dd") : null,
    createdAt: format(po.createdAt, "yyyy-MM-dd HH:mm"),
    notes: po.notes,
    items: po.items.map((i) => {
      const line = byProduct.get(i.productId);
      return {
        product: i.product.name,
        sku: i.product.sku,
        ordered: i.quantity,
        received: line?.received ?? 0,
        remaining: line?.remaining ?? i.quantity,
        unit: i.product.unit,
      };
    }),
  };
}

const dnIncludeReport = {
  po: { select: { poNumber: true } },
  partner: { select: { name: true, type: true } },
  warehouse: { select: { code: true, name: true } },
  items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
} as const;

export async function deliveryNoteListReport(query: {
  status?: "DRAFT" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  partnerName?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);

  const partners = query.partnerName
    ? await prisma.partner.findMany({
        where: { name: insensitive(query.partnerName) },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const unmatched: string[] = [];
  if (query.partnerName && partners.length === 0) unmatched.push(`partner "${query.partnerName}"`);
  const matched = { partners: partners.map((p) => p.name) };
  if (unmatched.length > 0)
    return { rows: [], meta: buildMeta(page, limit, 0), unmatched, matched };

  const shipDate = dateRange(query.from, query.to);
  const where: Prisma.DeliveryNoteWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(partners.length ? { partnerId: { in: partners.map((p) => p.id) } } : {}),
    ...(Object.keys(shipDate).length ? { shipDate } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.deliveryNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: dnIncludeReport,
    }),
    prisma.deliveryNote.count({ where }),
  ]);

  return {
    rows: rows.map((dn) => ({
      dnNumber: dn.dnNumber,
      status: dn.status,
      shipDate: format(dn.shipDate, "yyyy-MM-dd"),
      poNumber: dn.po?.poNumber ?? null,
      partner: dn.partner.name,
      warehouse: dn.warehouse.name,
      items: dn.items.map((i) => ({
        product: i.product.name,
        sku: i.product.sku,
        quantity: i.quantity,
        unit: i.product.unit,
      })),
    })),
    meta: buildMeta(page, limit, total),
    unmatched,
    matched,
  };
}
