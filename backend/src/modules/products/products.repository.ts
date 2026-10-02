import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { Prisma } from "@prisma/client";

const withCategory = { category: { select: { id: true, name: true } } } as const;

interface ListProductsParams {
  q?: string;
  categoryId?: number;
}

function buildWhere(params: ListProductsParams): Prisma.ProductWhereInput {
  return {
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { sku: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
  };
}

export async function listProducts(
  params: ListProductsParams & { skip: number; take: number },
  db: Db = prisma,
) {
  const where = buildWhere(params);
  const [rows, total] = await Promise.all([
    db.product.findMany({ where, orderBy: { name: "asc" }, skip: params.skip, take: params.take, include: withCategory }),
    db.product.count({ where }),
  ]);
  return { rows, total };
}

export function listAllProducts(params: ListProductsParams, db: Db = prisma) {
  return db.product.findMany({ where: buildWhere(params), orderBy: { name: "asc" }, include: withCategory });
}

export function findById(id: string, db: Db = prisma) {
  return db.product.findUnique({ where: { id }, include: withCategory });
}

export function findByIdPlain(id: string, db: Db = prisma) {
  return db.product.findUnique({ where: { id } });
}

export function findCategory(categoryId: number, db: Db = prisma) {
  return db.category.findUnique({ where: { id: categoryId } });
}

export function create(data: Prisma.ProductCreateInput, db: Db = prisma) {
  return db.product.create({ data, include: withCategory });
}

export function update(id: string, data: Prisma.ProductUpdateInput, db: Db = prisma) {
  return db.product.update({ where: { id }, data, include: withCategory });
}

export function remove(id: string, db: Db = prisma) {
  return db.product.delete({ where: { id } });
}

export function findStock(id: string, db: Db = prisma) {
  return db.product.findUnique({ where: { id }, select: { id: true, stock: true } });
}

export function adjustStock(id: string, delta: number, db: Db = prisma) {
  return db.product.update({ where: { id }, data: { stock: { increment: delta } } });
}

export async function countReferences(id: string, db: Db = prisma) {
  const [txns, poItems, dnItems] = await Promise.all([
    db.stockTransaction.count({ where: { productId: id } }),
    db.purchaseOrderItem.count({ where: { productId: id } }),
    db.deliveryNoteItem.count({ where: { productId: id } }),
  ]);
  return txns + poItems + dnItems;
}
