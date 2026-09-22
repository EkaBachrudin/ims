import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import type { z } from "zod";
import type { createCategorySchema, listCategorySchema, updateCategorySchema } from "./categories.schema";

export async function listCategories(query: z.infer<typeof listCategorySchema>["query"]) {
  return prisma.category.findMany({
    where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(
  input: z.infer<typeof createCategorySchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const category = await prisma.category.create({ data: { name: input.name } });
  await audit(
    { actorId, action: "CREATE", entity: "Category", entityId: String(category.id), after: category, ipAddress: ip },
    prisma,
  );
  return category;
}

export async function updateCategory(
  id: number,
  input: z.infer<typeof updateCategorySchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Category");
  const category = await prisma.category.update({ where: { id }, data: { name: input.name } });
  await audit(
    {
      actorId,
      action: "UPDATE",
      entity: "Category",
      entityId: String(id),
      before,
      after: category,
      ipAddress: ip,
    },
    prisma,
  );
  return category;
}

export async function deleteCategory(id: number, actorId?: string | null, ip?: string | null) {
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Category");

  const used = await prisma.product.count({ where: { categoryId: id } });
  if (used > 0) throw Errors.conflict("Kategori masih dipakai oleh produk");

  await prisma.category.delete({ where: { id } });
  await audit(
    { actorId, action: "DELETE", entity: "Category", entityId: String(id), before, ipAddress: ip },
    prisma,
  );
}
