import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { DnStatus, Prisma } from "@prisma/client";

export const dnInclude = {
  po: { select: { id: true, poNumber: true, status: true } },
  partner: { select: { id: true, name: true, type: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} as const;

export interface ListDnsFilter {
  status?: DnStatus;
  partnerId?: string;
  from?: Date;
  to?: Date;
}

function buildWhere(filter: ListDnsFilter): Prisma.DeliveryNoteWhereInput {
  const shipDate: Prisma.DateTimeFilter = {};
  if (filter.from) shipDate.gte = filter.from;
  if (filter.to) shipDate.lte = filter.to;

  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.partnerId ? { partnerId: filter.partnerId } : {}),
    ...(Object.keys(shipDate).length ? { shipDate } : {}),
  };
}

export async function listDns(
  filter: ListDnsFilter,
  pagination: { skip: number; take: number },
  db: Db = prisma,
) {
  const where = buildWhere(filter);
  const [rows, total] = await Promise.all([
    db.deliveryNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: dnInclude,
    }),
    db.deliveryNote.count({ where }),
  ]);
  return { rows, total };
}

export function findByIdWithDetails(id: string, db: Db = prisma) {
  return db.deliveryNote.findUnique({ where: { id }, include: dnInclude });
}

export function findByIdWithItems(id: string, db: Db = prisma) {
  return db.deliveryNote.findUnique({ where: { id }, include: { items: true } });
}

export function create(data: Prisma.DeliveryNoteUncheckedCreateInput, db: Db = prisma) {
  return db.deliveryNote.create({ data, include: dnInclude });
}

export function update(
  id: string,
  data: Prisma.DeliveryNoteUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.deliveryNote.update({ where: { id }, data, include: dnInclude });
}

export function deleteItems(dnId: string, db: Db = prisma) {
  return db.deliveryNoteItem.deleteMany({ where: { dnId } });
}

export function countByNumberPrefix(prefix: string, db: Db = prisma) {
  return db.deliveryNote.count({ where: { dnNumber: { startsWith: prefix } } });
}
