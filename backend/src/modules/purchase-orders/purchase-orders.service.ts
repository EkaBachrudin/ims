import type { PoSource, Prisma, PrismaClient } from "@prisma/client";
import { prisma, type PrismaTx } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { generatePoNumber } from "../../utils/numbering";
import { assertPoTransition } from "../../utils/po-state";
import type { z } from "zod";
import type {
  createPoSchema,
  draftPoSchema,
  listPoSchema,
  updatePoSchema,
} from "./purchase-orders.schema";

const poInclude = {
  partner: { select: { id: true, name: true, type: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} as const;

type WebItem = z.infer<typeof createPoSchema>["body"]["items"][number];
type Tx = PrismaTx | PrismaClient;

async function resolveWebItems(tx: Tx, items: WebItem[]) {
  const resolved: { productId: string; quantity: number; unitPrice: number | null }[] = [];
  for (const item of items) {
    let productId = item.productId;
    if (!productId && item.productName) {
      const product = await tx.product.findFirst({
        where: { name: { contains: item.productName, mode: "insensitive" } },
      });
      if (!product) throw Errors.unprocessable(`Produk "${item.productName}" tidak ditemukan`);
      productId = product.id;
    }
    if (!productId) throw Errors.unprocessable("Item PO membutuhkan productId atau productName");
    resolved.push({ productId, quantity: item.quantity, unitPrice: item.unitPrice ?? null });
  }
  return resolved;
}

export async function listPos(query: z.infer<typeof listPoSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) createdAt.gte = new Date(query.from);
  if (query.to) createdAt.lte = new Date(query.to);

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.partnerId ? { partnerId: query.partnerId } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: poInclude,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getPo(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!po) throw Errors.notFound("Purchase Order");
  return po;
}

export async function createPo(
  input: z.infer<typeof createPoSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
  if (!partner) throw Errors.notFound("Partner");

  const po = await prisma.$transaction(async (tx) => {
    const items = await resolveWebItems(tx, input.items);
    const poNumber = await generatePoNumber(tx, new Date());
    return tx.purchaseOrder.create({
      data: {
        poNumber,
        partnerId: input.partnerId,
        warehouseId: input.warehouseId ?? null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        notes: input.notes ?? null,
        source: input.source as PoSource,
        createdById: actorId,
        items: { create: items },
      },
      include: poInclude,
    });
  });

  await audit(
    { actorId, action: "CREATE", entity: "PurchaseOrder", entityId: po.id, after: po, ipAddress: ip },
    prisma,
  );
  return po;
}

export async function updatePo(
  id: string,
  input: z.infer<typeof updatePoSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!before) throw Errors.notFound("Purchase Order");
  if (before.status !== "DRAFT") throw Errors.invalidState("PO hanya dapat diubah saat DRAFT");

  const po = await prisma.$transaction(async (tx) => {
    if (input.items) {
      const items = await resolveWebItems(tx, input.items);
      await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(input.partnerId !== undefined ? { partnerId: input.partnerId } : {}),
          ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
          ...(input.targetDate !== undefined
            ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          items: { create: items },
        },
        include: poInclude,
      });
    }
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(input.partnerId !== undefined ? { partnerId: input.partnerId } : {}),
        ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: poInclude,
    });
  });

  await audit(
    { actorId, action: "UPDATE", entity: "PurchaseOrder", entityId: id, before, after: po, ipAddress: ip },
    prisma,
  );
  return po;
}

async function transition(
  id: string,
  to: "CONFIRMED" | "COMPLETED" | "CANCELLED",
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("Purchase Order");
  assertPoTransition(before.status, to);

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: to },
    include: poInclude,
  });

  await audit(
    { actorId, action: "UPDATE", entity: "PurchaseOrder", entityId: id, before, after: po, ipAddress: ip },
    prisma,
  );
  return po;
}

export const confirmPo = (id: string, actorId?: string | null, ip?: string | null) =>
  transition(id, "CONFIRMED", actorId, ip);

export const completePo = (id: string, actorId?: string | null, ip?: string | null) =>
  transition(id, "COMPLETED", actorId, ip);

export const cancelPo = (id: string, actorId?: string | null, ip?: string | null) =>
  transition(id, "CANCELLED", actorId, ip);

export async function deletePo(id: string, actorId?: string | null, ip?: string | null) {
  const before = await prisma.purchaseOrder.findUnique({ where: { id }, include: poInclude });
  if (!before) throw Errors.notFound("Purchase Order");
  if (before.status !== "DRAFT") throw Errors.invalidState("Hanya PO DRAFT yang dapat dihapus");

  await prisma.purchaseOrder.delete({ where: { id } });
  await audit(
    { actorId, action: "DELETE", entity: "PurchaseOrder", entityId: id, before, ipAddress: ip },
    prisma,
  );
}

/** Dibuat dari chat AI: resolve partner/produk by nama, status selalu DRAFT. */
export async function createDraftFromChat(
  input: z.infer<typeof draftPoSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  const partner = await prisma.partner.findFirst({
    where: { name: { contains: input.partnerName, mode: "insensitive" } },
  });
  if (!partner) throw Errors.unprocessable(`Partner "${input.partnerName}" tidak ditemukan`);

  const resolved: { productId: string; quantity: number }[] = [];
  for (const item of input.items) {
    const product = await prisma.product.findFirst({
      where: { name: { contains: item.productName, mode: "insensitive" } },
    });
    if (!product) throw Errors.unprocessable(`Produk "${item.productName}" tidak ditemukan`);
    resolved.push({ productId: product.id, quantity: item.qty });
  }

  let warehouseId: string | null = null;
  if (input.warehouseCode) {
    const warehouse = await prisma.warehouse.findUnique({ where: { code: input.warehouseCode } });
    warehouseId = warehouse?.id ?? null;
  } else {
    const warehouse = await prisma.warehouse.findFirst({ where: { isActive: true } });
    warehouseId = warehouse?.id ?? null;
  }

  const po = await prisma.$transaction(async (tx) => {
    const poNumber = await generatePoNumber(tx, new Date());
    return tx.purchaseOrder.create({
      data: {
        poNumber,
        partnerId: partner.id,
        warehouseId,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        notes: input.notes ?? "Dibuat via asisten AI",
        source: input.source as PoSource,
        createdById: actorId,
        items: { create: resolved },
      },
      include: poInclude,
    });
  });

  await audit(
    { actorId, action: "CREATE", entity: "PurchaseOrder", entityId: po.id, after: po, ipAddress: ip },
    prisma,
  );
  return po;
}
