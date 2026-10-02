import { prisma, type Db } from "../../infrastructure/prisma/client";

export function findInventory(productId: string, warehouseId: string, db: Db = prisma) {
  return db.inventory.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
}

/** Ubah kuantitas inventory yang sudah ada (dipakai saat void/reversal). */
export function incrementInventory(
  productId: string,
  warehouseId: string,
  delta: number,
  db: Db = prisma,
) {
  return db.inventory.update({
    where: { productId_warehouseId: { productId, warehouseId } },
    data: { quantity: { increment: delta } },
  });
}

export function upsertInventory(
  productId: string,
  warehouseId: string,
  initial: number,
  delta: number,
  db: Db = prisma,
) {
  return db.inventory.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { productId, warehouseId, quantity: initial },
    update: { quantity: { increment: delta } },
  });
}
