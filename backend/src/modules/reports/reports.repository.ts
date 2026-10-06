import { prisma, type Db } from "../../infrastructure/prisma/client";
import type {
  DnStatus,
  PartnerType,
  PoStatus,
  Prisma,
  TransactionType,
} from "@prisma/client";

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
