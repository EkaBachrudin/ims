import type { PoSource, Prisma, PrismaClient } from "@prisma/client";
import { prisma, type PrismaTx } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { generatePoNumber } from "../../utils/numbering";
import { assertPoTransition } from "../../utils/po-state";
import { resolveProductOrThrow } from "../products/product-resolver";
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

export type PoReceiptLine = {
  productId: string;
  ordered: number;
  received: number;
  remaining: number;
};

/**
 * Rekap realisasi penerimaan PO: agregasi transaksi IN bertaut `purchaseOrderId`
 * per produk, dibandingkan dengan qty yang dipesan.
 */
export async function getReceiptStatus(tx: Tx, poId: string): Promise<PoReceiptLine[]> {
  const [items, inbound, adjustments] = await Promise.all([
    tx.purchaseOrderItem.findMany({
      where: { poId },
      select: { productId: true, quantity: true },
    }),
    tx.stockTransaction.groupBy({
      by: ["productId"],
      where: { purchaseOrderId: poId, type: "IN" },
      _sum: { quantity: true },
    }),
    tx.stockTransaction.groupBy({
      by: ["productId"],
      where: { purchaseOrderId: poId, type: "ADJUSTMENT" },
      _sum: { quantity: true },
    }),
  ]);

  const ordered = new Map<string, number>();
  for (const item of items) {
    ordered.set(item.productId, (ordered.get(item.productId) ?? 0) + item.quantity);
  }
  const receivedByProduct = new Map(inbound.map((r) => [r.productId, r._sum.quantity ?? 0]));
  for (const adj of adjustments) {
    receivedByProduct.set(
      adj.productId,
      (receivedByProduct.get(adj.productId) ?? 0) - (adj._sum.quantity ?? 0),
    );
  }

  return [...ordered.entries()].map(([productId, orderedQty]) => {
    const receivedQty = Math.max(receivedByProduct.get(productId) ?? 0, 0);
    return {
      productId,
      ordered: orderedQty,
      received: receivedQty,
      remaining: Math.max(orderedQty - receivedQty, 0),
    };
  });
}

/**
 * Sinkronisasi status PO berdasarkan realisasi penerimaan:
 * - Semua item terpenuhi: CONFIRMED -> COMPLETED
 * - Realisasi berkurang (mis. void): COMPLETED -> CONFIRMED
 */
export async function syncPoReceiptStatus(tx: Tx, poId: string): Promise<void> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    select: { status: true },
  });
  if (!po || (po.status !== "CONFIRMED" && po.status !== "COMPLETED")) return;

  const lines = await getReceiptStatus(tx, poId);
  const fullyReceived = lines.length > 0 && lines.every((line) => line.received >= line.ordered);

  if (fullyReceived && po.status === "CONFIRMED") {
    await tx.purchaseOrder.update({ where: { id: poId }, data: { status: "COMPLETED" } });
  } else if (!fullyReceived && po.status === "COMPLETED") {
    await tx.purchaseOrder.update({ where: { id: poId }, data: { status: "CONFIRMED" } });
  }
}

async function resolveWebItems(tx: Tx, items: WebItem[]) {
  const resolved: { productId: string; quantity: number; unitPrice: number | null }[] = [];
  for (const item of items) {
    let productId = item.productId;
    if (!productId && item.productName) {
      const product = await resolveProductOrThrow(item.productName, tx);
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

  const lines = await getReceiptStatus(prisma, id);
  const byProduct = new Map(lines.map((line) => [line.productId, line]));

  return {
    ...po,
    items: po.items.map((item) => {
      const line = byProduct.get(item.productId);
      return {
        ...item,
        receivedQuantity: line?.received ?? 0,
        remainingQuantity: line?.remaining ?? item.quantity,
      };
    }),
  };
}

export async function createPo(
  input: z.infer<typeof createPoSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  const partner = await prisma.partner.findUnique({ where: { id: input.partnerId } });
  if (!partner) throw Errors.notFound("Partner");
  if (partner.type !== "SUPPLIER") {
    throw Errors.unprocessable("Purchase Order hanya untuk partner bertipe SUPPLIER");
  }

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
  to: "CONFIRMED" | "CANCELLED",
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
  if (partner.type !== "SUPPLIER") {
    throw Errors.unprocessable(`Partner "${partner.name}" bukan supplier`);
  }

  const resolved: { productId: string; quantity: number }[] = [];
  for (const item of input.items) {
    const product = await resolveProductOrThrow(item.productName);
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
