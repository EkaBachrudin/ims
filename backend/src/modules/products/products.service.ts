import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import { buildMeta, parsePagination } from "../../lib/pagination";
import * as repo from "./products.repository";
import type { z } from "zod";
import type { createProductSchema, listProductSchema, updateProductSchema } from "./products.schema";

export async function listProducts(query: z.infer<typeof listProductSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);

  // Filter low-stock membandingkan dua kolom (stock <= minStock) yang tidak didukung
  // where-condition Prisma, jadi difilter di application layer (skala UMKM).
  if (query.lowStock) {
    const all = await repo.listAllProducts({ q: query.q, categoryId: query.categoryId });
    const filtered = all.filter((p) => p.stock <= p.minStock);
    const rows = filtered.slice(skip, skip + take);
    return { rows, meta: buildMeta(page, limit, filtered.length) };
  }

  const { rows, total } = await repo.listProducts({
    q: query.q,
    categoryId: query.categoryId,
    skip,
    take,
  });
  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getProduct(id: string) {
  const product = await repo.findById(id);
  if (!product) throw Errors.notFound("Product");
  return product;
}

export async function createProduct(
  input: z.infer<typeof createProductSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const category = await repo.findCategory(input.categoryId);
  if (!category) throw Errors.unprocessable("Kategori tidak ditemukan");

  const product = await repo.create({
    sku: input.sku,
    name: input.name,
    description: input.description ?? null,
    unit: input.unit,
    minStock: input.minStock ?? 0,
    category: { connect: { id: input.categoryId } },
  });

  await container.audit.record(
    { actorId, action: "CREATE", entity: "Product", entityId: product.id, after: product, ipAddress: ip },
  );
  return product;
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findByIdPlain(id);
  if (!before) throw Errors.notFound("Product");

  if (input.categoryId !== undefined) {
    const category = await repo.findCategory(input.categoryId);
    if (!category) throw Errors.unprocessable("Kategori tidak ditemukan");
  }

  const product = await repo.update(id, {
    ...(input.sku !== undefined ? { sku: input.sku } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
    ...(input.categoryId !== undefined ? { category: { connect: { id: input.categoryId } } } : {}),
  });

  await container.audit.record(
    {
      actorId,
      action: "UPDATE",
      entity: "Product",
      entityId: id,
      before,
      after: product,
      ipAddress: ip,
    },
  );
  return product;
}

export async function deleteProduct(id: string, actorId?: string | null, ip?: string | null) {
  const before = await repo.findByIdPlain(id);
  if (!before) throw Errors.notFound("Product");

  const refs = await repo.countReferences(id);
  if (refs > 0) {
    throw Errors.conflict("Produk masih direferensikan transaksi/dokumen");
  }

  await repo.remove(id);
  await container.audit.record(
    { actorId, action: "DELETE", entity: "Product", entityId: id, before, ipAddress: ip },
  );
}
