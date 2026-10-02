import type { PoSource } from "@prisma/client";
import { Errors } from "../../lib/errors";
import { buildMeta, parsePagination } from "../../lib/pagination";
import { buildDocumentNumber, numberPrefix } from "../../domain/numbering";
import { assertPoTransition } from "../../domain/po-state";
import { container } from "../../composition/container";
import type { Db } from "../../infrastructure/prisma/client";
import { resolveProductOrThrow } from "../products/product-resolver";
import * as partnersRepo from "../partners/partners.repository";
import * as warehousesRepo from "../warehouses/warehouses.repository";
import * as usersRepo from "../users/users.repository";
import * as repo from "./purchase-orders.repository";
import type { z } from "zod";
import type {
  createPoSchema,
  draftPoSchema,
  listPoSchema,
  updatePoSchema,
} from "./purchase-orders.schema";

type WebItem = z.infer<typeof createPoSchema>["body"]["items"][number];

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
export async function getReceiptStatus(poId: string, db?: Db): Promise<PoReceiptLine[]> {
  const [items, { inbound, adjustments }] = await Promise.all([
    repo.listItems(poId, db),
    repo.receiptAggregates(poId, db),
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
export async function syncPoReceiptStatus(poId: string, db?: Db): Promise<void> {
  const po = await repo.findStatus(poId, db);
  if (!po || (po.status !== "CONFIRMED" && po.status !== "COMPLETED")) return;

  const lines = await getReceiptStatus(poId, db);
  const fullyReceived = lines.length > 0 && lines.every((line) => line.received >= line.ordered);

  if (fullyReceived && po.status === "CONFIRMED") {
    await repo.updateStatus(poId, "COMPLETED", db);
  } else if (!fullyReceived && po.status === "COMPLETED") {
    await repo.updateStatus(poId, "CONFIRMED", db);
  }
}

async function resolveWebItems(db: Db, items: WebItem[]) {
  const resolved: { productId: string; quantity: number; unitPrice: number | null }[] = [];
  for (const item of items) {
    let productId = item.productId;
    if (!productId && item.productName) {
      const product = await resolveProductOrThrow(item.productName, db);
      productId = product.id;
    }
    if (!productId) throw Errors.unprocessable("Item PO membutuhkan productId atau productName");
    resolved.push({ productId, quantity: item.quantity, unitPrice: item.unitPrice ?? null });
  }
  return resolved;
}

export async function listPos(query: z.infer<typeof listPoSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listPos(
    {
      status: query.status,
      partnerId: query.partnerId,
      source: query.source,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    },
    { skip, take },
  );

  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getPo(id: string) {
  const po = await repo.findByIdWithDetails(id);
  if (!po) throw Errors.notFound("Purchase Order");

  const lines = await getReceiptStatus(id);
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
  const partner = await partnersRepo.findById(input.partnerId);
  if (!partner) throw Errors.notFound("Partner");
  if (partner.type !== "SUPPLIER") {
    throw Errors.unprocessable("Purchase Order hanya untuk partner bertipe SUPPLIER");
  }

  const po = await container.uow.run(async (tx) => {
    const items = await resolveWebItems(tx, input.items);
    const date = new Date();
    const poNumber = buildDocumentNumber(
      "PO",
      date,
      await repo.countByNumberPrefix(numberPrefix("PO", date), tx),
    );
    return repo.create(
      {
        poNumber,
        partnerId: input.partnerId,
        warehouseId: input.warehouseId ?? null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        notes: input.notes ?? null,
        source: input.source as PoSource,
        createdById: actorId,
        items: { create: items },
      },
      tx,
    );
  });

  await container.audit.record({
    actorId,
    action: "CREATE",
    entity: "PurchaseOrder",
    entityId: po.id,
    after: po,
    ipAddress: ip,
  });
  return po;
}

export async function updatePo(
  id: string,
  input: z.infer<typeof updatePoSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findByIdWithDetails(id);
  if (!before) throw Errors.notFound("Purchase Order");
  if (before.status !== "DRAFT") throw Errors.invalidState("PO hanya dapat diubah saat DRAFT");

  const po = await container.uow.run(async (tx) => {
    if (input.items) {
      const items = await resolveWebItems(tx, input.items);
      await repo.deleteItems(id, tx);
      return repo.update(
        id,
        {
          ...(input.partnerId !== undefined ? { partnerId: input.partnerId } : {}),
          ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
          ...(input.targetDate !== undefined
            ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          items: { create: items },
        },
        tx,
      );
    }
    return repo.update(
      id,
      {
        ...(input.partnerId !== undefined ? { partnerId: input.partnerId } : {}),
        ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate ? new Date(input.targetDate) : null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      tx,
    );
  });

  await container.audit.record({
    actorId,
    action: "UPDATE",
    entity: "PurchaseOrder",
    entityId: id,
    before,
    after: po,
    ipAddress: ip,
  });
  return po;
}

async function transition(
  id: string,
  to: "CONFIRMED" | "CANCELLED",
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("Purchase Order");
  assertPoTransition(before.status, to);

  const po = await repo.updateStatus(id, to);

  await container.audit.record({
    actorId,
    action: "UPDATE",
    entity: "PurchaseOrder",
    entityId: id,
    before,
    after: po,
    ipAddress: ip,
  });

  const [creator, actor] = await Promise.all([
    usersRepo.findById(po.createdById),
    actorId ? usersRepo.findById(actorId) : Promise.resolve(null),
  ]);

  if (creator?.telegramId) {
    const confirmed = to === "CONFIRMED";
    await container.notifier.notifyUsers([creator], {
      text: [
        `${confirmed ? "✅" : "🚫"} **${po.poNumber}** ${confirmed ? "dikonfirmasi" : "dibatalkan"}.`,
        `• Supplier: ${po.partner.name}`,
        actor?.name ? `• Oleh: ${actor.name}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      button: { label: "Lihat PO", url: container.notifier.poUrl(po.id) },
    });
  }

  return po;
}

export const confirmPo = (id: string, actorId?: string | null, ip?: string | null) =>
  transition(id, "CONFIRMED", actorId, ip);

export const cancelPo = (id: string, actorId?: string | null, ip?: string | null) =>
  transition(id, "CANCELLED", actorId, ip);

export async function deletePo(id: string, actorId?: string | null, ip?: string | null) {
  const before = await repo.findByIdWithDetails(id);
  if (!before) throw Errors.notFound("Purchase Order");
  if (before.status !== "DRAFT") throw Errors.invalidState("Hanya PO DRAFT yang dapat dihapus");

  await repo.remove(id);
  await container.audit.record({
    actorId,
    action: "DELETE",
    entity: "PurchaseOrder",
    entityId: id,
    before,
    ipAddress: ip,
  });
}

/** Dibuat dari chat AI: resolve partner/produk by nama, status selalu DRAFT. */
export async function createDraftFromChat(
  input: z.infer<typeof draftPoSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  const partner = await partnersRepo.findFirstByName(input.partnerName);
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
    const warehouse = await warehousesRepo.findByCode(input.warehouseCode);
    warehouseId = warehouse?.id ?? null;
  } else {
    const warehouse = await warehousesRepo.findFirstActive();
    warehouseId = warehouse?.id ?? null;
  }

  const po = await container.uow.run(async (tx) => {
    const date = new Date();
    const poNumber = buildDocumentNumber(
      "PO",
      date,
      await repo.countByNumberPrefix(numberPrefix("PO", date), tx),
    );
    return repo.create(
      {
        poNumber,
        partnerId: partner.id,
        warehouseId,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        notes: input.notes ?? "Dibuat via asisten AI",
        source: input.source as PoSource,
        createdById: actorId,
        items: { create: resolved },
      },
      tx,
    );
  });

  await container.audit.record({
    actorId,
    action: "CREATE",
    entity: "PurchaseOrder",
    entityId: po.id,
    after: po,
    ipAddress: ip,
  });

  if (po.source === "AI_CHAT") {
    const admins = await usersRepo.findAdminsWithTelegram();
    await container.notifier.notifyUsers(admins, {
      text: [
        "🆕 **Draft PO baru** (via AI Chat)",
        `**${po.poNumber}** — ${po.partner.name}`,
        ...po.items.map((i) => `• ${i.quantity} ${i.product.unit} ${i.product.name}`),
        `Dibuat oleh: ${po.createdBy.name}`,
      ].join("\n"),
      button: { label: "Buka & Konfirmasi PO", url: container.notifier.poUrl(po.id) },
    });
  }

  return { ...po, webUrl: container.notifier.poUrl(po.id) };
}
