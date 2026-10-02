import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { Prisma } from "@prisma/client";

export function listWarehouses(q: string | undefined, db: Db = prisma) {
  return db.warehouse.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { code: "asc" },
  });
}

export function findById(id: string, db: Db = prisma) {
  return db.warehouse.findUnique({ where: { id } });
}

export function findByCode(code: string, db: Db = prisma) {
  return db.warehouse.findUnique({ where: { code } });
}

export function findFirstActive(db: Db = prisma, ordered = false) {
  return db.warehouse.findFirst({
    where: { isActive: true },
    ...(ordered ? { orderBy: { code: "asc" as const } } : {}),
  });
}

/** Cari gudang dari kode (exact, case-insensitive) atau nama (contains). */
export function findFirstByCodeOrName(value: string, db: Db = prisma, ordered = false) {
  return db.warehouse.findFirst({
    where: {
      OR: [
        { code: { equals: value, mode: "insensitive" } },
        { name: { contains: value, mode: "insensitive" } },
      ],
    },
    ...(ordered ? { orderBy: { code: "asc" as const } } : {}),
  });
}

export function create(data: Prisma.WarehouseCreateInput, db: Db = prisma) {
  return db.warehouse.create({ data });
}

export function update(id: string, data: Prisma.WarehouseUpdateInput, db: Db = prisma) {
  return db.warehouse.update({ where: { id }, data });
}

export function remove(id: string, db: Db = prisma) {
  return db.warehouse.delete({ where: { id } });
}

export async function countReferences(id: string, db: Db = prisma) {
  const [inv, txns, po, dn] = await Promise.all([
    db.inventory.count({ where: { warehouseId: id } }),
    db.stockTransaction.count({ where: { warehouseId: id } }),
    db.purchaseOrder.count({ where: { warehouseId: id } }),
    db.deliveryNote.count({ where: { warehouseId: id } }),
  ]);
  return inv + txns + po + dn;
}
