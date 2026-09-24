import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { generateDnNumber } from "../../utils/numbering";
import { assertDnTransition } from "../../utils/po-state";
import { applyStock } from "../transactions/transactions.service";
import type { z } from "zod";
import type {
  createDnSchema,
  draftDnSchema,
  listDnSchema,
  updateDnStatusSchema,
} from "./delivery-notes.schema";

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
    prisma.deliveryNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: dnInclude,
    }),
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
    items = items ?? po.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  }

  if (!partnerId) throw Errors.unprocessable("partnerId wajib diisi");
  if (!warehouseId)
    throw Errors.unprocessable("warehouseId wajib diisi (atau isi PO dengan gudang)");
  if (!items?.length) throw Errors.unprocessable("Item Surat Jalan kosong");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw Errors.notFound("Partner");
  if (partner.type !== "CUSTOMER") {
    throw Errors.unprocessable("Surat Jalan hanya untuk partner bertipe CUSTOMER");
  }

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
    {
      actorId,
      action: "CREATE",
      entity: "DeliveryNote",
      entityId: dn.id,
      after: dn,
      ipAddress: ip,
    },
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
    {
      actorId,
      action: "UPDATE",
      entity: "DeliveryNote",
      entityId: id,
      before,
      after: dn,
      ipAddress: ip,
    },
    prisma,
  );
  return dn;
}

/** Dibuat dari chat AI: resolve partner/produk by nama, status selalu DRAFT (stok belum berubah). */
export async function createDraftFromChat(
  input: z.infer<typeof draftDnSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  const partner = await prisma.partner.findFirst({
    where: { name: { contains: input.partnerName, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
  if (!partner) throw Errors.unprocessable(`Partner "${input.partnerName}" tidak ditemukan`);
  if (partner.type !== "CUSTOMER") {
    throw Errors.unprocessable(
      `Partner "${partner.name}" bukan customer; Surat Jalan hanya untuk customer`,
    );
  }

  const items: { productId: string; quantity: number }[] = [];
  for (const item of input.items) {
    const product = await prisma.product.findFirst({
      where: { name: { contains: item.productName, mode: "insensitive" } },
      orderBy: { name: "asc" },
    });
    if (!product) throw Errors.unprocessable(`Produk "${item.productName}" tidak ditemukan`);
    items.push({ productId: product.id, quantity: item.qty });
  }

  let warehouseId: string | undefined;
  if (input.warehouseCode) {
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: { equals: input.warehouseCode, mode: "insensitive" } },
          { name: { contains: input.warehouseCode, mode: "insensitive" } },
        ],
      },
    });
    if (!warehouse) throw Errors.unprocessable(`Gudang "${input.warehouseCode}" tidak ditemukan`);
    warehouseId = warehouse.id;
  } else {
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    warehouseId = warehouse?.id;
  }
  if (!warehouseId) throw Errors.unprocessable("Tidak ada gudang aktif untuk Surat Jalan");

  return createDn(
    {
      partnerId: partner.id,
      warehouseId,
      shipDate: input.shipDate ?? new Date().toISOString().slice(0, 10),
      notes: input.notes ?? "Dibuat via asisten AI",
      items,
    },
    actorId,
    ip,
  );
}
