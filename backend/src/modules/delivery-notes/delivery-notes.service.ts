import { Errors } from "../../lib/errors";
import { buildMeta, parsePagination } from "../../lib/pagination";
import { buildDocumentNumber, numberPrefix } from "../../domain/numbering";
import { assertDnTransition } from "../../domain/po-state";
import { container } from "../../composition/container";
import { applyStock } from "../transactions/transactions.service";
import * as stockRepo from "../transactions/transactions.repository";
import * as purchaseOrdersRepo from "../purchase-orders/purchase-orders.repository";
import * as partnersRepo from "../partners/partners.repository";
import * as warehousesRepo from "../warehouses/warehouses.repository";
import { resolveProductOrThrow } from "../products/product-resolver";
import * as repo from "./delivery-notes.repository";
import type { z } from "zod";
import type {
  createDnSchema,
  draftDnSchema,
  listDnSchema,
  updateDnSchema,
  updateDnStatusSchema,
} from "./delivery-notes.schema";

export async function listDns(query: z.infer<typeof listDnSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listDns(
    {
      status: query.status,
      partnerId: query.partnerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    },
    { skip, take },
  );

  return { rows, meta: buildMeta(page, limit, total) };
}

export async function getDn(id: string) {
  const dn = await repo.findByIdWithDetails(id);
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
    const po = await purchaseOrdersRepo.findByIdWithItems(input.poId);
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

  const partner = await partnersRepo.findById(partnerId);
  if (!partner) throw Errors.notFound("Partner");
  if (partner.type !== "CUSTOMER") {
    throw Errors.unprocessable("Surat Jalan hanya untuk partner bertipe CUSTOMER");
  }

  const dn = await container.uow.run(async (tx) => {
    const date = new Date();
    const dnNumber = buildDocumentNumber(
      "SJ",
      date,
      await repo.countByNumberPrefix(numberPrefix("SJ", date), tx),
    );
    return repo.create(
      {
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
      tx,
    );
  });

  await container.audit.record({
    actorId,
    action: "CREATE",
    entity: "DeliveryNote",
    entityId: dn.id,
    after: dn,
    ipAddress: ip,
  });
  return dn;
}

export async function updateDnStatus(
  id: string,
  input: z.infer<typeof updateDnStatusSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findByIdWithItems(id);
  if (!before) throw Errors.notFound("Delivery Note");
  assertDnTransition(before.status, input.status);

  const dn = await container.uow.run(async (tx) => {
    // FR-07.4 (opsional): saat DRAFT -> SHIPPED, buat transaksi OUT otomatis per item.
    if (before.status === "DRAFT" && input.status === "SHIPPED") {
      const already = await stockRepo.countByDeliveryNote(id, tx);
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

    return repo.update(
      id,
      { status: input.status, ...(input.notes !== undefined ? { notes: input.notes } : {}) },
      tx,
    );
  });

  await container.audit.record({
    actorId,
    action: "UPDATE",
    entity: "DeliveryNote",
    entityId: id,
    before,
    after: dn,
    ipAddress: ip,
  });
  return dn;
}

/** Ubah detail Surat Jalan (hanya saat DRAFT): partner, gudang, tanggal, catatan, item. */
export async function updateDn(
  id: string,
  input: z.infer<typeof updateDnSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findByIdWithItems(id);
  if (!before) throw Errors.notFound("Delivery Note");
  if (before.status !== "DRAFT") {
    throw Errors.invalidState("Surat Jalan hanya dapat diubah saat DRAFT");
  }

  const partnerId = input.partnerId ?? before.partnerId;
  const partner = await partnersRepo.findById(partnerId);
  if (!partner) throw Errors.notFound("Partner");
  if (partner.type !== "CUSTOMER") {
    throw Errors.unprocessable("Surat Jalan hanya untuk partner bertipe CUSTOMER");
  }

  const warehouseId = input.warehouseId ?? before.warehouseId;
  const warehouse = await warehousesRepo.findById(warehouseId);
  if (!warehouse) throw Errors.notFound("Warehouse");

  const data = {
    partnerId,
    warehouseId,
    ...(input.shipDate !== undefined ? { shipDate: new Date(input.shipDate) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  const dn = await container.uow.run(async (tx) => {
    if (input.items) {
      await repo.deleteItems(id, tx);
      return repo.update(id, { ...data, items: { create: input.items } }, tx);
    }
    return repo.update(id, data, tx);
  });

  await container.audit.record({
    actorId,
    action: "UPDATE",
    entity: "DeliveryNote",
    entityId: id,
    before,
    after: dn,
    ipAddress: ip,
  });
  return dn;
}

/** Dibuat dari chat AI: resolve partner/produk by nama, status selalu DRAFT (stok belum berubah). */
export async function createDraftFromChat(
  input: z.infer<typeof draftDnSchema>["body"],
  actorId: string,
  ip?: string | null,
) {
  const partner = await partnersRepo.findFirstByName(input.partnerName, undefined, true);
  if (!partner) throw Errors.unprocessable(`Partner "${input.partnerName}" tidak ditemukan`);
  if (partner.type !== "CUSTOMER") {
    throw Errors.unprocessable(
      `Partner "${partner.name}" bukan customer; Surat Jalan hanya untuk customer`,
    );
  }

  const items: { productId: string; quantity: number }[] = [];
  for (const item of input.items) {
    const product = await resolveProductOrThrow(item.productName);
    items.push({ productId: product.id, quantity: item.qty });
  }

  let warehouseId: string | undefined;
  if (input.warehouseCode) {
    const warehouse = await warehousesRepo.findFirstByCodeOrName(input.warehouseCode);
    if (!warehouse) throw Errors.unprocessable(`Gudang "${input.warehouseCode}" tidak ditemukan`);
    warehouseId = warehouse.id;
  } else {
    const warehouse = await warehousesRepo.findFirstActive(undefined, true);
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
