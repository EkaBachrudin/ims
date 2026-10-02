import { prisma, type Db } from "../../infrastructure/prisma/client";

export function listCategories(q: string | undefined, db: Db = prisma) {
  return db.category.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export function findById(id: number, db: Db = prisma) {
  return db.category.findUnique({ where: { id } });
}

export function create(name: string, db: Db = prisma) {
  return db.category.create({ data: { name } });
}

export function update(id: number, name: string, db: Db = prisma) {
  return db.category.update({ where: { id }, data: { name } });
}

export function remove(id: number, db: Db = prisma) {
  return db.category.delete({ where: { id } });
}

export function countProducts(categoryId: number, db: Db = prisma) {
  return db.product.count({ where: { categoryId } });
}
