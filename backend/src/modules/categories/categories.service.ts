import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import * as repo from "./categories.repository";
import type { z } from "zod";
import type { createCategorySchema, listCategorySchema, updateCategorySchema } from "./categories.schema";

export async function listCategories(query: z.infer<typeof listCategorySchema>["query"]) {
  return repo.listCategories(query.q);
}

export async function getCategory(id: number) {
  const category = await repo.findById(id);
  if (!category) throw Errors.notFound("Category");
  return category;
}

export async function createCategory(
  input: z.infer<typeof createCategorySchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const category = await repo.create(input.name);
  await container.audit.record(
    { actorId, action: "CREATE", entity: "Category", entityId: String(category.id), after: category, ipAddress: ip },
  );
  return category;
}

export async function updateCategory(
  id: number,
  input: z.infer<typeof updateCategorySchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Category");
  const category = await repo.update(id, input.name);
  await container.audit.record(
    {
      actorId,
      action: "UPDATE",
      entity: "Category",
      entityId: String(id),
      before,
      after: category,
      ipAddress: ip,
    },
  );
  return category;
}

export async function deleteCategory(id: number, actorId?: string | null, ip?: string | null) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Category");

  const used = await repo.countProducts(id);
  if (used > 0) throw Errors.conflict("Kategori masih dipakai oleh produk");

  await repo.remove(id);
  await container.audit.record(
    { actorId, action: "DELETE", entity: "Category", entityId: String(id), before, ipAddress: ip },
  );
}
