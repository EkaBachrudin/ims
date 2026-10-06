import { prisma, type Db } from "../../infrastructure/prisma/client";
import { Prisma } from "@prisma/client";
import type { DnStatus, PartnerType, PoStatus, TransactionType } from "@prisma/client";

export const stockProductInclude = { category: { select: { id: true, name: true } } } as const;

const poIncludeReport = {
  partner: { select: { name: true, type: true } },
  warehouse: { select: { code: true, name: true } },
  items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
} as const;

const dnIncludeReport = {
  po: { select: { poNumber: true } },
  partner: { select: { name: true, type: true } },
  warehouse: { select: { code: true, name: true } },
  items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
} as const;

const insensitive = (value: string) => ({ contains: value, mode: "insensitive" as const });

interface Pagination {
  skip: number;
  take: number;
}

interface DateRange {
  from?: Date;
  to?: Date;
}

// ----------------------------------------------------------------------
// Web reports
// ----------------------------------------------------------------------

export function stockReportProducts(
  params: { q?: string; categoryId?: number; warehouseId?: string },
  db: Db = prisma,
) {
  return db.product.findMany({
    where: {
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" as const } },
              { sku: { contains: params.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      category: { select: { id: true, name: true } },
      inventories: params.warehouseId
        ? {
            where: { warehouseId: params.warehouseId },
            include: { warehouse: { select: { id: true, code: true, name: true } } },
          }
        : { include: { warehouse: { select: { id: true, code: true, name: true } } } },
    },
  });
}

export function findProductWithCategory(id: string, db: Db = prisma) {
  return db.product.findUnique({ where: { id }, include: stockProductInclude });
}

export function findProductsWithCategoryByIds(ids: string[], db: Db = prisma) {
  return db.product.findMany({
    where: { id: { in: ids } },
    orderBy: { name: "asc" },
    include: stockProductInclude,
  });
}

export function findOutboundTransactions(from: Date, to: Date, db: Db = prisma) {
  return db.stockTransaction.findMany({
    where: { type: "OUT", createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { name: true, unit: true, sku: true } },
      partner: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  });
}

export function findAllProductsWithCategory(db: Db = prisma) {
  return db.product.findMany({
    orderBy: { stock: "asc" },
    include: { category: { select: { id: true, name: true } } },
  });
}

export function countProducts(db: Db = prisma) {
  return db.product.count();
}

export function countActivePos(db: Db = prisma) {
  return db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } });
}

export function countTransactions(type: TransactionType, from: Date, to: Date, db: Db = prisma) {
  return db.stockTransaction.count({ where: { type, createdAt: { gte: from, lte: to } } });
}

function dateRangeFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

export function sumTransactions(type: TransactionType, from?: Date, to?: Date, db: Db = prisma) {
  const createdAt = dateRangeFilter(from, to);
  return db.stockTransaction.aggregate({
    where: { type, ...(createdAt ? { createdAt } : {}) },
    _sum: { quantity: true },
    _count: true,
  });
}

export async function topOutboundPartners(from?: Date, to?: Date, take = 5, db: Db = prisma) {
  const createdAt = dateRangeFilter(from, to);
  const grouped = await db.stockTransaction.groupBy({
    by: ["partnerId"],
    where: { type: "OUT", partnerId: { not: null }, ...(createdAt ? { createdAt } : {}) },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take,
  });
  const partnerIds = grouped
    .map((g) => g.partnerId)
    .filter((id): id is string => Boolean(id));
  if (partnerIds.length === 0) return [];
  const partners = await db.partner.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(partners.map((p) => [p.id, p.name]));
  return grouped
    .filter((g): g is typeof g & { partnerId: string } => Boolean(g.partnerId))
    .map((g) => ({
      partner: nameById.get(g.partnerId) ?? "-",
      quantity: g._sum.quantity ?? 0,
    }));
}

export function findRecentTransactions(take: number, db: Db = prisma) {
  return db.stockTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

// ----------------------------------------------------------------------
// AI Agent read endpoints
// ----------------------------------------------------------------------

export async function listProductCatalog(
  params: { matchedIds: string[] | null; categoryId?: number } & Pagination,
  db: Db = prisma,
) {
  const where: Prisma.ProductWhereInput = {
    ...(params.matchedIds ? { id: { in: params.matchedIds } } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
  };
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: params.skip,
      take: params.take,
      include: { category: { select: { id: true, name: true } } },
    }),
    db.product.count({ where }),
  ]);
  return { rows, total };
}

export function listCategoriesWithCount(q: string | undefined, db: Db = prisma) {
  return db.category.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function listPartnerCatalog(
  params: { q?: string; type?: PartnerType } & Pagination,
  db: Db = prisma,
) {
  const where: Prisma.PartnerWhereInput = {
    ...(params.type ? { type: params.type } : {}),
    ...(params.q
      ? { OR: [{ name: insensitive(params.q) }, { phone: insensitive(params.q) }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.partner.findMany({
      where,
      orderBy: { name: "asc" },
      skip: params.skip,
      take: params.take,
    }),
    db.partner.count({ where }),
  ]);
  return { rows, total };
}

export function listWarehouseCatalog(q: string | undefined, db: Db = prisma) {
  return db.warehouse.findMany({
    where: q ? { OR: [{ name: insensitive(q) }, { code: insensitive(q) }] } : {},
    orderBy: { code: "asc" },
  });
}

export async function listInventory(
  params: { productIds: string[] | null; warehouseCode?: string } & Pagination,
  db: Db = prisma,
) {
  const where: Prisma.InventoryWhereInput = {
    ...(params.productIds ? { productId: { in: params.productIds } } : {}),
    ...(params.warehouseCode
      ? {
          warehouse: {
            OR: [
              { code: { contains: params.warehouseCode, mode: "insensitive" as const } },
              { name: { contains: params.warehouseCode, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.inventory.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: {
        product: { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
      },
    }),
    db.inventory.count({ where }),
  ]);
  return { rows, total };
}

export function findWarehousesByCodeOrName(value: string, db: Db = prisma) {
  return db.warehouse.findMany({
    where: { OR: [{ code: insensitive(value) }, { name: insensitive(value) }] },
    orderBy: { code: "asc" },
    select: { id: true, name: true },
  });
}

export function findPartnersByName(value: string, db: Db = prisma) {
  return db.partner.findMany({
    where: { name: insensitive(value) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function listTransactionsReport(
  params: {
    type?: TransactionType;
    productIds?: string[];
    warehouseIds?: string[];
    partnerIds?: string[];
  } & DateRange &
    Pagination,
  db: Db = prisma,
) {
  const createdAt: Prisma.DateTimeFilter = {};
  if (params.from) createdAt.gte = params.from;
  if (params.to) createdAt.lte = params.to;

  const where: Prisma.StockTransactionWhereInput = {
    ...(params.type ? { type: params.type } : {}),
    ...(params.productIds?.length ? { productId: { in: params.productIds } } : {}),
    ...(params.warehouseIds?.length ? { warehouseId: { in: params.warehouseIds } } : {}),
    ...(params.partnerIds?.length ? { partnerId: { in: params.partnerIds } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    db.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: {
        product: { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
        partner: { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } },
        deliveryNote: { select: { dnNumber: true } },
        createdBy: { select: { name: true } },
      },
    }),
    db.stockTransaction.count({ where }),
  ]);
  return { rows, total };
}

export async function listPosReport(
  params: {
    status?: PoStatus;
    statuses?: PoStatus[];
    partnerIds?: string[];
  } & DateRange &
    Pagination,
  db: Db = prisma,
) {
  const createdAt: Prisma.DateTimeFilter = {};
  if (params.from) createdAt.gte = params.from;
  if (params.to) createdAt.lte = params.to;

  const statusWhere: Prisma.PurchaseOrderWhereInput = params.status
    ? { status: params.status }
    : params.statuses?.length
      ? { status: { in: params.statuses } }
      : {};

  const where: Prisma.PurchaseOrderWhereInput = {
    ...statusWhere,
    ...(params.partnerIds?.length ? { partnerId: { in: params.partnerIds } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: poIncludeReport,
    }),
    db.purchaseOrder.count({ where }),
  ]);
  return { rows, total };
}

export function findPoByNumberReport(poNumber: string, db: Db = prisma) {
  return db.purchaseOrder.findFirst({
    where: { poNumber: { equals: poNumber, mode: "insensitive" } },
    include: poIncludeReport,
  });
}

// ----------------------------------------------------------------------
// Agregasi laporan (tren & ringkasan persediaan)
// ----------------------------------------------------------------------

export interface StockTrendBucket {
  period: string;
  inbound: number;
  outbound: number;
  adjustment: number;
}

export function stockTrend(
  from: Date,
  to: Date,
  bucket: "day" | "week" | "month",
  db: Db = prisma,
) {
  return db.$queryRaw<StockTrendBucket[]>(Prisma.sql`
    SELECT to_char(date_trunc(${bucket}, "createdAt"), 'YYYY-MM-DD') AS "period",
           COALESCE(SUM(CASE WHEN "type" = 'IN' THEN "quantity" ELSE 0 END), 0)::int AS "inbound",
           COALESCE(SUM(CASE WHEN "type" = 'OUT' THEN "quantity" ELSE 0 END), 0)::int AS "outbound",
           COALESCE(SUM(CASE WHEN "type" = 'ADJUSTMENT' THEN "quantity" ELSE 0 END), 0)::int AS "adjustment"
    FROM "stock_transactions"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY 1
    ORDER BY 1
  `);
}

export async function countLowStock(db: Db = prisma) {
  const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT count(*)::int AS "count" FROM "products" WHERE "stock" <= "minStock"
  `);
  return rows[0]?.count ?? 0;
}

export function sumProductStock(db: Db = prisma) {
  return db.product.aggregate({ _sum: { stock: true }, _count: true });
}

export function stockByCategory(db: Db = prisma) {
  return db.$queryRaw<{ category: string; products: number; units: number }[]>(Prisma.sql`
    SELECT COALESCE(c."name", 'Tanpa kategori') AS "category",
           count(p."id")::int AS "products",
           COALESCE(SUM(p."stock"), 0)::int AS "units"
    FROM "products" p
    LEFT JOIN "categories" c ON c."id" = p."categoryId"
    GROUP BY 1
    ORDER BY "units" DESC
  `);
}

export function stockByWarehouse(db: Db = prisma) {
  return db.$queryRaw<{ warehouse: string; code: string; units: number }[]>(Prisma.sql`
    SELECT w."name" AS "warehouse",
           w."code" AS "code",
           COALESCE(SUM(i."quantity"), 0)::int AS "units"
    FROM "inventories" i
    JOIN "warehouses" w ON w."id" = i."warehouseId"
    GROUP BY w."id", w."name", w."code"
    ORDER BY "units" DESC
  `);
}

// ----------------------------------------------------------------------
// Ringkasan pembelian (PO) & pengiriman (DN)
// ----------------------------------------------------------------------

export function poByStatus(from: Date, to: Date, db: Db = prisma) {
  return db.$queryRaw<{ status: string; count: number }[]>(Prisma.sql`
    SELECT po."status"::text AS "status", count(*)::int AS "count"
    FROM "purchase_orders" po
    WHERE po."createdAt" >= ${from} AND po."createdAt" <= ${to}
    GROUP BY po."status"
    ORDER BY po."status"
  `);
}

export async function poSummaryTotals(from: Date, to: Date, db: Db = prisma) {
  const rows = await db.$queryRaw<
    { totalPos: number; totalOrderedQty: number; totalValue: number }[]
  >(Prisma.sql`
    SELECT count(DISTINCT po."id")::int AS "totalPos",
           COALESCE(SUM(i."quantity"), 0)::int AS "totalOrderedQty",
           COALESCE(SUM(i."quantity" * i."unitPrice"), 0)::float AS "totalValue"
    FROM "purchase_orders" po
    JOIN "purchase_order_items" i ON i."poId" = po."id"
    WHERE po."createdAt" >= ${from} AND po."createdAt" <= ${to}
  `);
  return rows[0] ?? { totalPos: 0, totalOrderedQty: 0, totalValue: 0 };
}

export function topSuppliers(from: Date, to: Date, take = 5, db: Db = prisma) {
  return db.$queryRaw<{ supplier: string; qty: number; value: number }[]>(Prisma.sql`
    SELECT p."name" AS "supplier",
           COALESCE(SUM(i."quantity"), 0)::int AS "qty",
           COALESCE(SUM(i."quantity" * i."unitPrice"), 0)::float AS "value"
    FROM "purchase_orders" po
    JOIN "partners" p ON p."id" = po."partnerId"
    JOIN "purchase_order_items" i ON i."poId" = po."id"
    WHERE po."createdAt" >= ${from} AND po."createdAt" <= ${to}
    GROUP BY p."id", p."name"
    ORDER BY "value" DESC, "qty" DESC
    LIMIT ${take}
  `);
}

export function dnByStatus(from: Date, to: Date, db: Db = prisma) {
  return db.$queryRaw<{ status: string; count: number }[]>(Prisma.sql`
    SELECT dn."status"::text AS "status", count(*)::int AS "count"
    FROM "delivery_notes" dn
    WHERE dn."shipDate" >= ${from} AND dn."shipDate" <= ${to}
    GROUP BY dn."status"
    ORDER BY dn."status"
  `);
}

export async function dnSummaryTotals(from: Date, to: Date, db: Db = prisma) {
  const rows = await db.$queryRaw<{ totalDns: number; totalQty: number }[]>(Prisma.sql`
    SELECT count(DISTINCT dn."id")::int AS "totalDns",
           COALESCE(SUM(di."quantity"), 0)::int AS "totalQty"
    FROM "delivery_notes" dn
    JOIN "delivery_note_items" di ON di."dnId" = dn."id"
    WHERE dn."shipDate" >= ${from} AND dn."shipDate" <= ${to}
  `);
  return rows[0] ?? { totalDns: 0, totalQty: 0 };
}

export function topCustomers(from: Date, to: Date, take = 5, db: Db = prisma) {
  return db.$queryRaw<{ customer: string; qty: number }[]>(Prisma.sql`
    SELECT p."name" AS "customer",
           COALESCE(SUM(di."quantity"), 0)::int AS "qty"
    FROM "delivery_notes" dn
    JOIN "partners" p ON p."id" = dn."partnerId"
    JOIN "delivery_note_items" di ON di."dnId" = dn."id"
    WHERE dn."shipDate" >= ${from} AND dn."shipDate" <= ${to}
    GROUP BY p."id", p."name"
    ORDER BY "qty" DESC
    LIMIT ${take}
  `);
}

export function topDeliveredProducts(from: Date, to: Date, take = 5, db: Db = prisma) {
  return db.$queryRaw<{ product: string; sku: string; qty: number }[]>(Prisma.sql`
    SELECT pr."name" AS "product",
           pr."sku" AS "sku",
           COALESCE(SUM(di."quantity"), 0)::int AS "qty"
    FROM "delivery_notes" dn
    JOIN "delivery_note_items" di ON di."dnId" = dn."id"
    JOIN "products" pr ON pr."id" = di."productId"
    WHERE dn."shipDate" >= ${from} AND dn."shipDate" <= ${to}
    GROUP BY pr."id", pr."name", pr."sku"
    ORDER BY "qty" DESC
    LIMIT ${take}
  `);
}

export function dnByWarehouse(from: Date, to: Date, db: Db = prisma) {
  return db.$queryRaw<{ warehouse: string; code: string; qty: number }[]>(Prisma.sql`
    SELECT w."name" AS "warehouse",
           w."code" AS "code",
           COALESCE(SUM(di."quantity"), 0)::int AS "qty"
    FROM "delivery_notes" dn
    JOIN "warehouses" w ON w."id" = dn."warehouseId"
    JOIN "delivery_note_items" di ON di."dnId" = dn."id"
    WHERE dn."shipDate" >= ${from} AND dn."shipDate" <= ${to}
    GROUP BY w."id", w."name", w."code"
    ORDER BY "qty" DESC
  `);
}

// ----------------------------------------------------------------------
// Kartu stok, analitik gerak stok, aktivitas pengguna
// ----------------------------------------------------------------------

export function findProductBySku(sku: string, db: Db = prisma) {
  return db.product.findFirst({
    where: { sku: { equals: sku, mode: "insensitive" } },
    include: stockProductInclude,
  });
}

export async function signedBalanceBefore(productId: string, before: Date, db: Db = prisma) {
  const rows = await db.$queryRaw<{ delta: number }[]>(Prisma.sql`
    SELECT COALESCE(SUM(CASE WHEN "type" = 'OUT' THEN -"quantity" ELSE "quantity" END), 0)::int AS "delta"
    FROM "stock_transactions"
    WHERE "productId" = ${productId} AND "createdAt" < ${before}
  `);
  return rows[0]?.delta ?? 0;
}

export function listMovementsForCard(
  productId: string,
  from: Date,
  to: Date,
  db: Db = prisma,
) {
  return db.stockTransaction.findMany({
    where: { productId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    include: {
      warehouse: { select: { code: true, name: true } },
      partner: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export function topOutboundProducts(from: Date, to: Date, take: number, db: Db = prisma) {
  return db.$queryRaw<{ sku: string; product: string; qty: number }[]>(Prisma.sql`
    SELECT p."sku" AS "sku",
           p."name" AS "product",
           COALESCE(SUM(t."quantity"), 0)::int AS "qty"
    FROM "stock_transactions" t
    JOIN "products" p ON p."id" = t."productId"
    WHERE t."type" = 'OUT' AND t."createdAt" >= ${from} AND t."createdAt" <= ${to}
    GROUP BY p."id", p."sku", p."name"
    ORDER BY "qty" DESC
    LIMIT ${take}
  `);
}

export function outboundByProduct(from: Date, to: Date, db: Db = prisma) {
  return db.$queryRaw<{ sku: string; product: string; qty: number }[]>(Prisma.sql`
    SELECT p."sku" AS "sku",
           p."name" AS "product",
           COALESCE(SUM(t."quantity"), 0)::int AS "qty"
    FROM "stock_transactions" t
    JOIN "products" p ON p."id" = t."productId"
    WHERE t."type" = 'OUT' AND t."createdAt" >= ${from} AND t."createdAt" <= ${to}
    GROUP BY p."id", p."sku", p."name"
    ORDER BY "qty" DESC
  `);
}

export function deadStockProducts(cutoff: Date, db: Db = prisma) {
  return db.$queryRaw<
    { sku: string; product: string; unit: string; stock: number; lastOut: Date | null }[]
  >(Prisma.sql`
    SELECT p."sku" AS "sku",
           p."name" AS "product",
           p."unit" AS "unit",
           p."stock" AS "stock",
           MAX(t."createdAt") AS "lastOut"
    FROM "products" p
    LEFT JOIN "stock_transactions" t
      ON t."productId" = p."id" AND t."type" = 'OUT'
    GROUP BY p."id", p."sku", p."name", p."unit", p."stock"
    HAVING MAX(t."createdAt") IS NULL OR MAX(t."createdAt") < ${cutoff}
    ORDER BY p."stock" DESC
  `);
}

export function userActivity(from: Date, to: Date, db: Db = prisma) {
  return db.$queryRaw<
    {
      user: string;
      role: string;
      inCount: number;
      inQty: number;
      outCount: number;
      outQty: number;
      adjustmentCount: number;
      total: number;
    }[]
  >(Prisma.sql`
    SELECT u."name" AS "user",
           u."role"::text AS "role",
           count(*) FILTER (WHERE t."type" = 'IN')::int AS "inCount",
           COALESCE(SUM(t."quantity") FILTER (WHERE t."type" = 'IN'), 0)::int AS "inQty",
           count(*) FILTER (WHERE t."type" = 'OUT')::int AS "outCount",
           COALESCE(SUM(t."quantity") FILTER (WHERE t."type" = 'OUT'), 0)::int AS "outQty",
           count(*) FILTER (WHERE t."type" = 'ADJUSTMENT')::int AS "adjustmentCount",
           count(*)::int AS "total"
    FROM "stock_transactions" t
    JOIN "users" u ON u."id" = t."createdById"
    WHERE t."createdAt" >= ${from} AND t."createdAt" <= ${to}
    GROUP BY u."id", u."name", u."role"
    ORDER BY "total" DESC
  `);
}

export async function listDnsReport(
  params: { status?: DnStatus; partnerIds?: string[] } & DateRange & Pagination,
  db: Db = prisma,
) {
  const shipDate: Prisma.DateTimeFilter = {};
  if (params.from) shipDate.gte = params.from;
  if (params.to) shipDate.lte = params.to;

  const where: Prisma.DeliveryNoteWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.partnerIds?.length ? { partnerId: { in: params.partnerIds } } : {}),
    ...(Object.keys(shipDate).length ? { shipDate } : {}),
  };

  const [rows, total] = await Promise.all([
    db.deliveryNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: dnIncludeReport,
    }),
    db.deliveryNote.count({ where }),
  ]);
  return { rows, total };
}
