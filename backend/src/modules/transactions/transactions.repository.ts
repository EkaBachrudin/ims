import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { Prisma, TransactionType } from "@prisma/client";

const listInclude = {
  product: { select: { id: true, sku: true, name: true, unit: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  partner: { select: { id: true, name: true } },
  purchaseOrder: { select: { id: true, poNumber: true } },
  deliveryNote: { select: { id: true, dnNumber: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export interface ListTransactionsFilter {
  type?: TransactionType;
  productId?: string;
  warehouseId?: string;
  partnerId?: string;
  deliveryNoteId?: string;
  from?: Date;
  to?: Date;
  q?: string;
}

function buildWhere(filter: ListTransactionsFilter): Prisma.StockTransactionWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;
  const q = filter.q;

  return {
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.productId ? { productId: filter.productId } : {}),
    ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    ...(filter.partnerId ? { partnerId: filter.partnerId } : {}),
    ...(filter.deliveryNoteId ? { deliveryNoteId: filter.deliveryNoteId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { referenceNo: { contains: q, mode: "insensitive" as const } },
            { product: { name: { contains: q, mode: "insensitive" as const } } },
            { product: { sku: { contains: q, mode: "insensitive" as const } } },
            { partner: { name: { contains: q, mode: "insensitive" as const } } },
            { createdBy: { name: { contains: q, mode: "insensitive" as const } } },
            { purchaseOrder: { poNumber: { contains: q, mode: "insensitive" as const } } },
            { deliveryNote: { dnNumber: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

export async function listTransactions(
  filter: ListTransactionsFilter,
  pagination: { skip: number; take: number },
  db: Db = prisma,
) {
  const where = buildWhere(filter);
  const [rows, total] = await Promise.all([
    db.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: listInclude,
    }),
    db.stockTransaction.count({ where }),
  ]);
  return { rows, total };
}

export function findById(id: string, db: Db = prisma) {
  return db.stockTransaction.findUnique({ where: { id } });
}

export function create(data: Prisma.StockTransactionUncheckedCreateInput, db: Db = prisma) {
  return db.stockTransaction.create({ data });
}

export function countByDeliveryNote(deliveryNoteId: string, db: Db = prisma) {
  return db.stockTransaction.count({ where: { deliveryNoteId } });
}
