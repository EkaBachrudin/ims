import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import type { z } from "zod";
import type { createProductSchema, listProductSchema, updateProductSchema } from "./products.schema";

const withCategory = { category: { select: { id: true, name: true } } } as const;

export async function listProducts(query: z.infer<typeof listProductSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { sku: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  };

  // Filter low-stock membandingkan dua kolom (stock <= minStock) yang tidak didukung
  // where-condition Prisma, jadi difilter di application layer (skala UMKM).
  if (query.lowStock) {
    const all = await prisma.product.findMany({ where, orderBy: { name: "asc" }, include: withCategory });
    const filtered = all.filter((p) => p.stock <= p.minStock);
    const rows = filtered.slice(skip, skip + take);
    return { rows, meta: buildMeta(page, limit, filtered.length) };
  }

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { name: "asc" }, skip, take, include: withCategory }),
    prisma.product.count({ where }),
  ]);
  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: withCategory });
  if (!product) throw Errors.notFound("Product");
  return product;
}

export async function createProduct(
  input: z.infer<typeof createProductSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw Errors.unprocessable("Kategori tidak ditemukan");

  const product = await prisma.product.create({
    data: {
      sku: input.sku,
      name: input.name,
      description: input.description ?? null,
      unit: input.unit,
      minStock: input.minStock ?? 0,
      categoryId: input.categoryId,
    },
    include: withCategory,
  });

  await audit(
    { actorId, action: "CREATE", entity: "Product", entityId: product.id, after: product, ipAddress: ip },
    prisma,
  );
  return product;
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Product");

  if (input.categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw Errors.unprocessable("Kategori tidak ditemukan");
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    },
    include: withCategory,
  });

  await audit(
    {
      actorId,
      action: "UPDATE",
      entity: "Product",
      entityId: id,
      before,
      after: product,
      ipAddress: ip,
    },
    prisma,
  );
  return product;
}

export async function deleteProduct(id: string, actorId?: string | null, ip?: string | null) {
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Product");

  const [txns, poItems, dnItems] = await Promise.all([
    prisma.stockTransaction.count({ where: { productId: id } }),
    prisma.purchaseOrderItem.count({ where: { productId: id } }),
    prisma.deliveryNoteItem.count({ where: { productId: id } }),
  ]);
  if (txns + poItems + dnItems > 0) {
    throw Errors.conflict("Produk masih direferensikan transaksi/dokumen");
  }

  await prisma.product.delete({ where: { id } });
  await audit(
    { actorId, action: "DELETE", entity: "Product", entityId: id, before, ipAddress: ip },
    prisma,
  );
}
