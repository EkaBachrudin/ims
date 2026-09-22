import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { generateDnNumber } from "../../utils/numbering";
import { assertDnTransition } from "../../utils/po-state";
import { applyStock } from "../transactions/transactions.service";
import type { z } from "zod";
import type { createDnSchema, listDnSchema, updateDnStatusSchema } from "./delivery-notes.schema";

const dnInclude = {
  po: { select: { id: true, poNumber: true, status: true } },
  partner: { select: { id: true, name: true, type: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} as const;

export async function listDns(query: z.infer<typeof listDnSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const shipDate: Prisma.DateTimeFilter = {};
  if (query.from) shipDate.gte = new Date(query.from);
  if (query.to) shipDate.lte = new Date(query.to);

  const where: Prisma.DeliveryNoteWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.partnerId ? { partnerId: query.partnerId } : {}),
    ...(Object.keys(shipDate).length ? { shipDate } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.deliveryNote.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: dnInclude }),
    prisma.deliveryNote.count({ where }),
  ]);

  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getDn(id: string) {
  const dn = await prisma.deliveryNote.findUnique({ where: { id }, include: dnInclude });
  if (!dn) throw Errors.notFound("Delivery Note");
  return dn;
}

export async function createDn(
  input: z.infer<typeof createDnSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  let partnerId = input.partnerId;
  let warehouseId = input.warehouseId;
  let items = input.items;

  if (input.poId) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: input.poId },
      include: { items: true },
    });
    if (!po) throw Errors.notFound("Purchase Order");
    if (po.status !== "CONFIRMED" && po.status !== "COMPLETED") {
      throw Errors.invalidState("Surat Jalan hanya dari PO CONFIRMED/COMPLETED");
    }
    partnerId = partnerId ?? po.partnerId;
    warehouseId = warehouseId ?? po.warehouseId ?? undefined;
    items =
      items ??
      po.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  }

  if (!partnerId) throw Errors.unprocessable("partnerId wajib diisi");
  if (!warehouseId) throw Errors.unprocessable("warehouseId wajib diisi (atau isi PO dengan gudang)");
  if (!items?.length) throw Errors.unprocessable("Item Surat Jalan kosong");

  const dn = await prisma.$transaction(async (tx) => {
    const dnNumber = await generateDnNumber(tx, new Date());
    return tx.deliveryNote.create({
      data: {
        dnNumber,
        status: "DRAFT",
        shipDate: new Date(input.shipDate),
        notes: input.notes ?? null,
        poId: input.poId ?? null,
        partnerId: partnerId as string,
        warehouseId: warehouseId as string,
        createdById: actorId,
        items: { create: items },
      },
      include: dnInclude,
    });
  });

  await audit(
    { actorId, action: "CREATE", entity: "DeliveryNote", entityId: dn.id, after: dn, ipAddress: ip },
    prisma,
  );
  return dn;
}

export async function updateDnStatus(
  id: string,
  input: z.infer<typeof updateDnStatusSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.deliveryNote.findUnique({ where: { id }, include: { items: true } });
  if (!before) throw Errors.notFound("Delivery Note");
  assertDnTransition(before.status, input.status);

  const dn = await prisma.$transaction(async (tx) => {
    // FR-07.4 (opsional): saat DRAFT -> SHIPPED, buat transaksi OUT otomatis per item.
    if (before.status === "DRAFT" && input.status === "SHIPPED") {
      const already = await tx.stockTransaction.count({ where: { deliveryNoteId: id } });
      if (already === 0) {
        for (const item of before.items) {
          await applyStock(tx, "OUT", {
            productId: item.productId,
            warehouseId: before.warehouseId,
            quantity: item.quantity,
            deliveryNoteId: id,
            partnerId: before.partnerId,
            notes: `Pengiriman ${before.dnNumber}`,
            createdById: actorId ?? before.createdById,
          });
        }
      }
    }

    return tx.deliveryNote.update({
      where: { id },
      data: { status: input.status, ...(input.notes !== undefined ? { notes: input.notes } : {}) },
      include: dnInclude,
    });
  });

  await audit(
    { actorId, action: "UPDATE", entity: "DeliveryNote", entityId: id, before, after: dn, ipAddress: ip },
    prisma,
  );
  return dn;
}
