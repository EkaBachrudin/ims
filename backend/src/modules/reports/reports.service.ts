import { endOfDay, format, startOfDay } from "date-fns";
import { buildMeta, parsePagination } from "../../lib/pagination";
import { getReceiptStatus } from "../purchase-orders/purchase-orders.service";
import { resolveProduct, searchProducts } from "../products/product-resolver";
import * as repo from "./reports.repository";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function stockReport(query: {
  q?: string;
  categoryId?: number;
  warehouseId?: string;
}) {
  const products = await repo.stockReportProducts(query);

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

/**
 * Lookup stok berdasarkan nama bebas. Mengembalikan status eksplisit agar
 * kandidat (ambiguous) maupun saran (none) tidak hilang menjadi null.
 */
export async function findStockByProductName(productName: string): Promise<StockLookupResult> {
  const match = await resolveProduct(productName);

  if (match.status === "ok") {
    const product = await repo.findProductWithCategory(match.product.id);
    if (!product) return { status: "none", product: null, candidates: [], suggestions: [] };
    return { status: "ok", product: toStockProduct(product), candidates: [], suggestions: [] };
  }

  if (match.status === "ambiguous") {
    const candidates = await repo.findProductsWithCategoryByIds(match.candidates.map((c) => c.id));
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

  const rows = await repo.findOutboundTransactions(from, to);

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
  const products = await repo.findAllProductsWithCategory();
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
    repo.countProducts(),
    repo.countActivePos(),
    repo.countTransactions("IN", from, to),
    repo.countTransactions("OUT", from, to),
    repo.findAllProductsWithCategory(),
  ]);

  const recentTransactions = await repo.findRecentTransactions(10);

  return {
    totalProducts,
    activePOs,
    todayInbound,
    todayOutbound,
    lowStockCount: lowStockRows.filter((p) => p.stock <= p.minStock).length,
    recentTransactions,
  };
}

export async function periodSummaryReport(query: { from?: string; to?: string }) {
  const now = new Date();
  const fromDate = query.from
    ? startOfDay(parseLocalDate(query.from))
    : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const toDate = query.to ? endOfDay(parseLocalDate(query.to)) : endOfDay(now);

  const [inbound, outbound, topPartners, totalProducts, activePOs, lowStockRows] = await Promise.all([
    repo.sumTransactions("IN", fromDate, toDate),
    repo.sumTransactions("OUT", fromDate, toDate),
    repo.topOutboundPartners(fromDate, toDate),
    repo.countProducts(),
    repo.countActivePos(),
    repo.findAllProductsWithCategory(),
  ]);

  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    totalProducts,
    activePOs,
    lowStockCount: lowStockRows.filter((p) => p.stock <= p.minStock).length,
    inbound: { quantity: inbound._sum.quantity ?? 0, count: inbound._count },
    outbound: { quantity: outbound._sum.quantity ?? 0, count: outbound._count },
    topPartners,
  };
}

export async function stockTrendReport(query: {
  from?: string;
  to?: string;
  bucket?: "day" | "week" | "month";
}) {
  const now = new Date();
  const fromDate = query.from
    ? startOfDay(parseLocalDate(query.from))
    : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const toDate = query.to ? endOfDay(parseLocalDate(query.to)) : endOfDay(now);
  const bucket = query.bucket ?? "day";

  const buckets = await repo.stockTrend(fromDate, toDate, bucket);

  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    bucket,
    buckets,
  };
}

export async function stockSummaryReport() {
  const [totals, lowStockCount, byCategory, byWarehouse] = await Promise.all([
    repo.sumProductStock(),
    repo.countLowStock(),
    repo.stockByCategory(),
    repo.stockByWarehouse(),
  ]);

  return {
    totalProducts: totals._count,
    totalUnits: totals._sum.stock ?? 0,
    lowStockCount,
    byCategory,
    byWarehouse,
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

function dateRange(from?: string, to?: string): { from?: Date; to?: Date } {
  return {
    from: from ? startOfDay(parseLocalDate(from)) : undefined,
    to: to ? endOfDay(parseLocalDate(to)) : undefined,
  };
}

export async function productCatalog(query: {
  q?: string;
  categoryId?: number;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);
  const matchedIds = query.q ? (await searchProducts(query.q)).map((p) => p.id) : null;
  const { rows, total } = await repo.listProductCatalog({
    matchedIds,
    categoryId: query.categoryId,
    skip,
    take,
  });

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
  const rows = await repo.listCategoriesWithCount(query.q);
  return rows.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
}

export async function partnerCatalog(query: {
  q?: string;
  type?: "SUPPLIER" | "CUSTOMER";
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listPartnerCatalog({
    q: query.q,
    type: query.type,
    skip,
    take,
  });

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
  const rows = await repo.listWarehouseCatalog(query.q);
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
  const { rows, total } = await repo.listInventory({
    productIds: matchedProductIds,
    warehouseCode: query.warehouseCode,
    skip,
    take,
  });

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

  const products = query.productName ? await searchProducts(query.productName) : [];
  const warehouses = query.warehouseCode
    ? await repo.findWarehousesByCodeOrName(query.warehouseCode)
    : [];
  const partners = query.partnerName ? await repo.findPartnersByName(query.partnerName) : [];

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

  const range = dateRange(query.from, query.to);
  const { rows, total } = await repo.listTransactionsReport({
    type: query.type,
    productIds: products.map((p) => p.id),
    warehouseIds: warehouses.map((w) => w.id),
    partnerIds: partners.map((p) => p.id),
    ...range,
    skip,
    take,
  });

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

  const partners = query.partnerName ? await repo.findPartnersByName(query.partnerName) : [];
  const unmatched: string[] = [];
  if (query.partnerName && partners.length === 0) unmatched.push(`partner "${query.partnerName}"`);
  const matched = { partners: partners.map((p) => p.name) };
  if (unmatched.length > 0)
    return { rows: [], meta: buildMeta(page, limit, 0), unmatched, matched };

  const range = dateRange(query.from, query.to);
  const { rows, total } = await repo.listPosReport({
    status: query.status,
    statuses: query.statuses,
    partnerIds: partners.map((p) => p.id),
    ...range,
    skip,
    take,
  });

  return {
    rows: rows.map((po) => {
      const items = po.items.map((i) => {
        const unitPrice = i.unitPrice === null ? null : Number(i.unitPrice);
        return {
          product: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          unit: i.product.unit,
          unitPrice,
          value: unitPrice === null ? null : round2(i.quantity * unitPrice),
        };
      });
      return {
        poNumber: po.poNumber,
        status: po.status,
        source: po.source,
        partner: po.partner.name,
        warehouse: po.warehouse?.name ?? null,
        targetDate: po.targetDate ? format(po.targetDate, "yyyy-MM-dd") : null,
        createdAt: format(po.createdAt, "yyyy-MM-dd HH:mm"),
        totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
        totalValue: round2(items.reduce((sum, i) => sum + (i.value ?? 0), 0)),
        items,
      };
    }),
    meta: buildMeta(page, limit, total),
    unmatched,
    matched,
  };
}

export async function purchaseOrderDetailReport(poNumber: string) {
  const po = await repo.findPoByNumberReport(poNumber);
  if (!po) return null;

  const lines = await getReceiptStatus(po.id);
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

export async function deliveryNoteListReport(query: {
  status?: "DRAFT" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  partnerName?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { page, limit, skip, take } = parsePagination(query);

  const partners = query.partnerName ? await repo.findPartnersByName(query.partnerName) : [];
  const unmatched: string[] = [];
  if (query.partnerName && partners.length === 0) unmatched.push(`partner "${query.partnerName}"`);
  const matched = { partners: partners.map((p) => p.name) };
  if (unmatched.length > 0)
    return { rows: [], meta: buildMeta(page, limit, 0), unmatched, matched };

  const range = dateRange(query.from, query.to);
  const { rows, total } = await repo.listDnsReport({
    status: query.status,
    partnerIds: partners.map((p) => p.id),
    ...range,
    skip,
    take,
  });

  return {
    rows: rows.map((dn) => ({
      dnNumber: dn.dnNumber,
      status: dn.status,
      shipDate: format(dn.shipDate, "yyyy-MM-dd"),
      poNumber: dn.po?.poNumber ?? null,
      partner: dn.partner.name,
      warehouse: dn.warehouse.name,
      totalQuantity: dn.items.reduce((sum, i) => sum + i.quantity, 0),
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

function summaryRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
  const now = new Date();
  const fromDate = from
    ? startOfDay(parseLocalDate(from))
    : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const toDate = to ? endOfDay(parseLocalDate(to)) : endOfDay(now);
  return { fromDate, toDate };
}

export async function poSummaryReport(query: { from?: string; to?: string }) {
  const { fromDate, toDate } = summaryRange(query.from, query.to);

  const [byStatus, totals, topSuppliers] = await Promise.all([
    repo.poByStatus(fromDate, toDate),
    repo.poSummaryTotals(fromDate, toDate),
    repo.topSuppliers(fromDate, toDate),
  ]);

  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    byStatus,
    totalPos: totals.totalPos,
    totalOrderedQty: totals.totalOrderedQty,
    totalValue: round2(totals.totalValue),
    topSuppliers: topSuppliers.map((s) => ({ ...s, value: round2(s.value) })),
  };
}

export async function dnSummaryReport(query: { from?: string; to?: string }) {
  const { fromDate, toDate } = summaryRange(query.from, query.to);

  const [byStatus, totals, topCustomers, topProducts, byWarehouse] = await Promise.all([
    repo.dnByStatus(fromDate, toDate),
    repo.dnSummaryTotals(fromDate, toDate),
    repo.topCustomers(fromDate, toDate),
    repo.topDeliveredProducts(fromDate, toDate),
    repo.dnByWarehouse(fromDate, toDate),
  ]);

  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    byStatus,
    totalDns: totals.totalDns,
    totalQty: totals.totalQty,
    topCustomers,
    topProducts,
    byWarehouse,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function stockCardReport(query: { productName: string; from?: string; to?: string }) {
  const now = new Date();
  const fromDate = query.from
    ? startOfDay(parseLocalDate(query.from))
    : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const toDate = query.to ? endOfDay(parseLocalDate(query.to)) : endOfDay(now);
  const from = format(fromDate, "yyyy-MM-dd");
  const to = format(toDate, "yyyy-MM-dd");

  const base = { from, to, opening: 0, closing: 0, movements: [] as unknown[] };

  // Coba cocokkan SKU persis dulu, lalu resolusi nama bebas.
  let product = await repo.findProductBySku(query.productName);
  if (!product) {
    const match = await resolveProduct(query.productName);
    if (match.status === "ambiguous") {
      return { status: "ambiguous" as const, ...base, product: null, candidates: match.candidates, suggestions: [] };
    }
    if (match.status === "none") {
      return { status: "none" as const, ...base, product: null, candidates: [], suggestions: match.suggestions };
    }
    product = await repo.findProductWithCategory(match.product.id);
  }
  if (!product) {
    return { status: "none" as const, ...base, product: null, candidates: [], suggestions: [] };
  }

  const opening = await repo.signedBalanceBefore(product.id, fromDate);
  const rows = await repo.listMovementsForCard(product.id, fromDate, toDate);

  let balance = opening;
  const movements = rows.map((r) => {
    const signed = r.type === "OUT" ? -r.quantity : r.quantity;
    balance += signed;
    return {
      date: format(r.createdAt, "yyyy-MM-dd HH:mm"),
      type: r.type,
      quantity: r.quantity,
      signed,
      balance,
      warehouse: r.warehouse.name,
      partner: r.partner?.name ?? null,
      referenceNo: r.referenceNo,
      notes: r.notes,
      createdBy: r.createdBy.name,
    };
  });

  return {
    status: "ok" as const,
    from,
    to,
    product: {
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      category: product.category?.name ?? null,
    },
    opening,
    closing: balance,
    movements,
    candidates: [] as { id: string; name: string; sku: string }[],
    suggestions: [] as { id: string; name: string; sku: string }[],
  };
}

export async function movementAnalysisReport(query: {
  from?: string;
  to?: string;
  deadDays?: number;
  top?: number;
}) {
  const { fromDate, toDate } = summaryRange(query.from, query.to);
  const deadDays = query.deadDays ?? 30;
  const top = query.top ?? 10;
  const cutoff = new Date(toDate.getTime() - deadDays * 86_400_000);

  const [topMovers, allOutbound, deadRows] = await Promise.all([
    repo.topOutboundProducts(fromDate, toDate, top),
    repo.outboundByProduct(fromDate, toDate),
    repo.deadStockProducts(cutoff),
  ]);

  const totalQty = allOutbound.reduce((sum, r) => sum + r.qty, 0);
  let cumulative = 0;
  const abc = allOutbound.map((r) => {
    const share = totalQty > 0 ? r.qty / totalQty : 0;
    cumulative += share;
    const cls = cumulative <= 0.8 ? "A" : cumulative <= 0.95 ? "B" : "C";
    return {
      sku: r.sku,
      product: r.product,
      qty: r.qty,
      share: round3(share),
      cumulative: round3(cumulative),
      class: cls,
    };
  });

  const deadStock = deadRows.map((r) => ({
    sku: r.sku,
    product: r.product,
    unit: r.unit,
    stock: r.stock,
    lastOutDate: r.lastOut ? format(r.lastOut, "yyyy-MM-dd") : null,
    daysSinceOut: r.lastOut
      ? Math.floor((toDate.getTime() - r.lastOut.getTime()) / 86_400_000)
      : null,
  }));

  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    deadDays,
    topMovers,
    deadStock,
    abc,
  };
}

export async function userActivityReport(query: { from?: string; to?: string }) {
  const { fromDate, toDate } = summaryRange(query.from, query.to);
  const users = await repo.userActivity(fromDate, toDate);
  return {
    from: format(fromDate, "yyyy-MM-dd"),
    to: format(toDate, "yyyy-MM-dd"),
    users,
  };
}
