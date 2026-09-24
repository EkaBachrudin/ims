import type { Prisma, TransactionType } from "@prisma/client";
import { prisma, type PrismaTx } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { getReceiptStatus, syncPoReceiptStatus } from "../purchase-orders/purchase-orders.service";
import type { z } from "zod";
import type { listTransactionSchema, recordTransactionSchema } from "./transactions.schema";

type RecordInput = z.infer<typeof recordTransactionSchema>["body"] & { createdById: string };

/**
 * Inti perubahan stok. WAJIB dipanggil di dalam `prisma.$transaction`.
 * - Membuat baris StockTransaction
 * - Update denormalized Product.stock
 * - Update Inventory per gudang
 */
export async function applyStock(tx: PrismaTx, type: TransactionType, input: RecordInput) {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, stock: true },
  });
  if (!product) throw Errors.notFound("Product");

  const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) throw Errors.notFound("Warehouse");

  const delta = type === "OUT" ? -input.quantity : input.quantity;

  if (type === "OUT") {
    if (product.stock < input.quantity) throw Errors.insufficientStock();
    const inventory = await tx.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });
    if (!inventory || inventory.quantity < input.quantity) throw Errors.insufficientStock();
  }

  if (type === "IN" && input.purchaseOrderId) {
    const po = await tx.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: { partner: { select: { type: true } } },
    });
    if (!po) throw Errors.notFound("Purchase Order");
    if (po.status !== "CONFIRMED") {
      throw Errors.invalidState("Penerimaan hanya untuk PO berstatus CONFIRMED");
    }
    if (po.partner.type !== "SUPPLIER") {
      throw Errors.unprocessable("PO sumber penerimaan harus dari partner SUPPLIER");
    }

    const lines = await getReceiptStatus(tx, po.id);
    const line = lines.find((l) => l.productId === input.productId);
    if (!line) throw Errors.unprocessable("Produk tidak ada pada PO sumber");
    if (input.quantity > line.remaining) {
      throw Errors.unprocessable(`Qty melebihi sisa pesanan PO (sisa ${line.remaining})`);
    }
  }

  const txn = await tx.stockTransaction.create({
    data: {
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
  });

  await tx.product.update({
    where: { id: input.productId },
    data: { stock: { increment: delta } },
  });

  await tx.inventory.upsert({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    create: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
    },
    update: { quantity: { increment: delta } },
  });

  if (type === "IN" && input.purchaseOrderId) {
    await syncPoReceiptStatus(tx, input.purchaseOrderId);
  }

  return txn;
}

export async function recordTransaction(
  type: "IN" | "OUT",
  input: RecordInput & { createdById: string },
  actorId?: string | null,
  ip?: string | null,
) {
  const txn = await prisma.$transaction((tx) => applyStock(tx, type, input));

  await audit(
    {
      actorId,
      action: "CREATE",
      entity: "StockTransaction",
      entityId: txn.id,
      after: txn,
      ipAddress: ip,
    },
    prisma,
  );

  return txn;
}

export async function voidTransaction(
  id: string,
  reason: string,
  actorId?: string | null,
  ip?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.stockTransaction.findUnique({ where: { id } });
    if (!original) throw Errors.notFound("Transaction");
    if (original.type === "ADJUSTMENT" && (original.notes ?? "").startsWith("VOID:")) {
      throw Errors.invalidState("Transaksi void tidak dapat di-void ulang");
    }

    // Soft reversal: catat ADJUSTMENT kompensasi lalu koreksi stok.
    const reversalDelta = original.type === "OUT" ? original.quantity : -original.quantity;

    const adjustment = await tx.stockTransaction.create({
      data: {
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
    });

    await tx.product.update({
      where: { id: original.productId },
      data: { stock: { increment: reversalDelta } },
    });

    await tx.inventory.update({
      where: {
        productId_warehouseId: {
          productId: original.productId,
          warehouseId: original.warehouseId,
        },
      },
      data: { quantity: { increment: reversalDelta } },
    });

    if (original.type === "IN" && original.purchaseOrderId) {
      await syncPoReceiptStatus(tx, original.purchaseOrderId);
    }

    await audit(
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
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) createdAt.gte = new Date(query.from);
  if (query.to) createdAt.lte = new Date(query.to);

  const where: Prisma.StockTransactionWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.deliveryNoteId ? { deliveryNoteId: query.deliveryNoteId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        partner: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        deliveryNote: { select: { id: true, dnNumber: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.stockTransaction.count({ where }),
  ]);

  return { rows, meta: buildMeta(page, limit, total) };
}
