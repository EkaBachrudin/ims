import type { TransactionType } from "@prisma/client";
import { Errors } from "../../lib/errors";
import { buildMeta, parsePagination } from "../../lib/pagination";
import { container } from "../../composition/container";
import type { Db } from "../../infrastructure/prisma/client";
import * as repo from "./transactions.repository";
import * as inventory from "./inventory.repository";
import * as productsRepo from "../products/products.repository";
import * as warehousesRepo from "../warehouses/warehouses.repository";
import * as usersRepo from "../users/users.repository";
import * as purchaseOrdersRepo from "../purchase-orders/purchase-orders.repository";
import {
  getReceiptStatus,
  syncPoReceiptStatus,
} from "../purchase-orders/purchase-orders.service";
import type { z } from "zod";
import type { listTransactionSchema, recordTransactionSchema } from "./transactions.schema";

type RecordInput = z.infer<typeof recordTransactionSchema>["body"] & { createdById: string };

/**
 * Inti perubahan stok. WAJIB dipanggil di dalam sebuah transaksi (`container.uow.run`).
 * - Membuat baris StockTransaction
 * - Update denormalized Product.stock
 * - Update Inventory per gudang
 */
export async function applyStock(tx: Db, type: TransactionType, input: RecordInput) {
  const product = await productsRepo.findStock(input.productId, tx);
  if (!product) throw Errors.notFound("Product");

  const warehouse = await warehousesRepo.findById(input.warehouseId, tx);
  if (!warehouse) throw Errors.notFound("Warehouse");

  const delta = type === "OUT" ? -input.quantity : input.quantity;

  if (type === "OUT") {
    if (product.stock < input.quantity) throw Errors.insufficientStock();
    const inventoryRow = await inventory.findInventory(input.productId, input.warehouseId, tx);
    if (!inventoryRow || inventoryRow.quantity < input.quantity) throw Errors.insufficientStock();
  }

  if (type === "IN" && input.purchaseOrderId) {
    const po = await purchaseOrdersRepo.findReceiptInfo(input.purchaseOrderId, tx);
    if (!po) throw Errors.notFound("Purchase Order");
    if (po.status !== "CONFIRMED") {
      throw Errors.invalidState("Penerimaan hanya untuk PO berstatus CONFIRMED");
    }
    if (po.partner.type !== "SUPPLIER") {
      throw Errors.unprocessable("PO sumber penerimaan harus dari partner SUPPLIER");
    }

    const lines = await getReceiptStatus(input.purchaseOrderId, tx);
    const line = lines.find((l) => l.productId === input.productId);
    if (!line) throw Errors.unprocessable("Produk tidak ada pada PO sumber");
    if (input.quantity > line.remaining) {
      throw Errors.unprocessable(`Qty melebihi sisa pesanan PO (sisa ${line.remaining})`);
    }
  }

  const txn = await repo.create(
    {
      type,
      quantity: input.quantity,
      notes: input.notes ?? null,
      referenceNo: input.referenceNo ?? null,
      productId: input.productId,
      warehouseId: input.warehouseId,
      partnerId: input.partnerId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      deliveryNoteId: input.deliveryNoteId ?? null,
      createdById: input.createdById,
    },
    tx,
  );

  await productsRepo.adjustStock(input.productId, delta, tx);

  await inventory.upsertInventory(input.productId, input.warehouseId, input.quantity, delta, tx);

  if (type === "IN" && input.purchaseOrderId) {
    await syncPoReceiptStatus(input.purchaseOrderId, tx);
  }

  return txn;
}

export async function recordTransaction(
  type: "IN" | "OUT",
  input: RecordInput & { createdById: string },
  actorId?: string | null,
  ip?: string | null,
) {
  const poId = type === "IN" ? (input.purchaseOrderId ?? null) : null;
  const beforePo = poId ? await purchaseOrdersRepo.findStatus(poId) : null;

  const txn = await container.uow.run((tx) => applyStock(tx, type, input));

  await container.audit.record({
    actorId,
    action: "CREATE",
    entity: "StockTransaction",
    entityId: txn.id,
    after: txn,
    ipAddress: ip,
  });

  // Kabari pembuat PO saat realisasi penerimaan menuntaskan seluruh item.
  if (poId && beforePo?.status !== "COMPLETED") {
    const po = await purchaseOrdersRepo.findNotificationInfo(poId);
    if (po?.status === "COMPLETED") {
      const creator = await usersRepo.findById(po.createdById);
      if (creator?.telegramId) {
        await container.notifier.notifyUsers([creator], {
          text: [
            "📦 **Penerimaan selesai**",
            `**${po.poNumber}** — seluruh barang sudah diterima.`,
          ].join("\n"),
          button: { label: "Lihat PO", url: container.notifier.poUrl(poId) },
        });
      }
    }
  }

  return txn;
}

export async function voidTransaction(
  id: string,
  reason: string,
  actorId?: string | null,
  ip?: string | null,
) {
  return container.uow.run(async (tx) => {
    const original = await repo.findById(id, tx);
    if (!original) throw Errors.notFound("Transaction");
    if (original.type === "ADJUSTMENT" && (original.notes ?? "").startsWith("VOID:")) {
      throw Errors.invalidState("Transaksi void tidak dapat di-void ulang");
    }

    // Soft reversal: catat ADJUSTMENT kompensasi lalu koreksi stok.
    const reversalDelta = original.type === "OUT" ? original.quantity : -original.quantity;

    const adjustment = await repo.create(
      {
        type: "ADJUSTMENT",
        quantity: original.quantity,
        notes: `VOID: ${reason} (ref ${original.id})`,
        productId: original.productId,
        warehouseId: original.warehouseId,
        partnerId: original.partnerId,
        purchaseOrderId: original.purchaseOrderId,
        deliveryNoteId: original.deliveryNoteId,
        referenceNo: original.referenceNo,
        createdById: actorId ?? original.createdById,
      },
      tx,
    );

    await productsRepo.adjustStock(original.productId, reversalDelta, tx);

    await inventory.incrementInventory(original.productId, original.warehouseId, reversalDelta, tx);

    if (original.type === "IN" && original.purchaseOrderId) {
      await syncPoReceiptStatus(original.purchaseOrderId, tx);
    }

    await container.audit.record(
      {
        actorId,
        action: "VOID",
        entity: "StockTransaction",
        entityId: id,
        before: original,
        after: adjustment,
        ipAddress: ip,
      },
      tx,
    );

    return adjustment;
  });
}

export async function listTransactions(query: z.infer<typeof listTransactionSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listTransactions(
    {
      type: query.type,
      productId: query.productId,
      warehouseId: query.warehouseId,
      partnerId: query.partnerId,
      deliveryNoteId: query.deliveryNoteId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      q: query.q,
    },
    { skip, take },
  );

  return { rows, meta: buildMeta(page, limit, total) };
}
