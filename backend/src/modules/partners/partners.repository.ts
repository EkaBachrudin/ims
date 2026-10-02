import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { PartnerType, Prisma } from "@prisma/client";

export interface ListPartnersParams {
  q?: string;
  type?: PartnerType;
  skip: number;
  take: number;
}

function buildWhere(params: { q?: string; type?: PartnerType }): Prisma.PartnerWhereInput {
  return {
    ...(params.type ? { type: params.type } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { phone: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listPartners(params: ListPartnersParams, db: Db = prisma) {
  const where = buildWhere(params);
  const [rows, total] = await Promise.all([
    db.partner.findMany({ where, orderBy: { name: "asc" }, skip: params.skip, take: params.take }),
    db.partner.count({ where }),
  ]);
  return { rows, total };
}

export function findById(id: string, db: Db = prisma) {
  return db.partner.findUnique({ where: { id } });
}

export function findFirstByName(name: string, db: Db = prisma, ordered = false) {
  return db.partner.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
    ...(ordered ? { orderBy: { name: "asc" as const } } : {}),
  });
}

export function create(data: Prisma.PartnerCreateInput, db: Db = prisma) {
  return db.partner.create({ data });
}

export function update(id: string, data: Prisma.PartnerUpdateInput, db: Db = prisma) {
  return db.partner.update({ where: { id }, data });
}

export function remove(id: string, db: Db = prisma) {
  return db.partner.delete({ where: { id } });
}

export async function countReferences(id: string, db: Db = prisma) {
  const [po, dn, txns] = await Promise.all([
    db.purchaseOrder.count({ where: { partnerId: id } }),
    db.deliveryNote.count({ where: { partnerId: id } }),
    db.stockTransaction.count({ where: { partnerId: id } }),
  ]);
  return po + dn + txns;
}
