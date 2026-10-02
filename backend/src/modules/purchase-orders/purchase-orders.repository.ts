import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { PoSource, PoStatus, Prisma } from "@prisma/client";

export const poInclude = {
  partner: { select: { id: true, name: true, type: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} as const;

export interface ListPosFilter {
  status?: PoStatus;
  partnerId?: string;
  source?: PoSource;
  from?: Date;
  to?: Date;
}

function buildWhere(filter: ListPosFilter): Prisma.PurchaseOrderWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;

  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.partnerId ? { partnerId: filter.partnerId } : {}),
    ...(filter.source ? { source: filter.source } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
}

export async function listPos(
  filter: ListPosFilter,
  pagination: { skip: number; take: number },
  db: Db = prisma,
) {
  const where = buildWhere(filter);
  const [rows, total] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: poInclude,
    }),
    db.purchaseOrder.count({ where }),
  ]);
  return { rows, total };
}

export function findById(id: string, db: Db = prisma) {
  return db.purchaseOrder.findUnique({ where: { id } });
}

export function findByIdWithDetails(id: string, db: Db = prisma) {
  return db.purchaseOrder.findUnique({ where: { id }, include: poInclude });
}

export function findByIdWithItems(id: string, db: Db = prisma) {
  return db.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
}

export function findStatus(id: string, db: Db = prisma) {
  return db.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
}

export function findReceiptInfo(id: string, db: Db = prisma) {
  return db.purchaseOrder.findUnique({
    where: { id },
    include: { partner: { select: { type: true } } },
  });
}

export function findNotificationInfo(id: string, db: Db = prisma) {
  return db.purchaseOrder.findUnique({
    where: { id },
    select: { status: true, poNumber: true, createdById: true },
  });
}

export function create(data: Prisma.PurchaseOrderUncheckedCreateInput, db: Db = prisma) {
  return db.purchaseOrder.create({ data, include: poInclude });
}

export function update(
  id: string,
  data: Prisma.PurchaseOrderUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.purchaseOrder.update({ where: { id }, data, include: poInclude });
}

export function updateStatus(id: string, status: PoStatus, db: Db = prisma) {
  return db.purchaseOrder.update({ where: { id }, data: { status }, include: poInclude });
}

export function remove(id: string, db: Db = prisma) {
  return db.purchaseOrder.delete({ where: { id } });
}

export function countByNumberPrefix(prefix: string, db: Db = prisma) {
  return db.purchaseOrder.count({ where: { poNumber: { startsWith: prefix } } });
}

export function deleteItems(poId: string, db: Db = prisma) {
  return db.purchaseOrderItem.deleteMany({ where: { poId } });
}

export function listItems(poId: string, db: Db = prisma) {
  return db.purchaseOrderItem.findMany({
    where: { poId },
    select: { productId: true, quantity: true },
  });
}

export async function receiptAggregates(poId: string, db: Db = prisma) {
  const [inbound, adjustments] = await Promise.all([
    db.stockTransaction.groupBy({
      by: ["productId"],
      where: { purchaseOrderId: poId, type: "IN" },
      _sum: { quantity: true },
    }),
    db.stockTransaction.groupBy({
      by: ["productId"],
      where: { purchaseOrderId: poId, type: "ADJUSTMENT" },
      _sum: { quantity: true },
    }),
  ]);
  return { inbound, adjustments };
}
