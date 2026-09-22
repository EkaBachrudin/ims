import { format } from "date-fns";
import type { PrismaTx } from "../lib/prisma";
import type { PrismaClient } from "@prisma/client";

type Tx = PrismaTx | PrismaClient;

/**
 * Generate nomor PO unik berformat `PO-YYYYMM-NNN`.
 * Dipanggil di dalam transaksi agar penomoran konsisten.
 */
export async function generatePoNumber(tx: Tx, date: Date = new Date()): Promise<string> {
  const yyyymm = format(date, "yyyyMM");
  const prefix = `PO-${yyyymm}-`;
  const count = await tx.purchaseOrder.count({ where: { poNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

/** Generate nomor Surat Jalan unik berformat `SJ-YYYYMM-NNN`. */
export async function generateDnNumber(tx: Tx, date: Date = new Date()): Promise<string> {
  const yyyymm = format(date, "yyyyMM");
  const prefix = `SJ-${yyyymm}-`;
  const count = await tx.deliveryNote.count({ where: { dnNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
