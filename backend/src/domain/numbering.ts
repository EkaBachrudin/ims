import { format } from "date-fns";

export type DocumentKind = "PO" | "SJ";

/** Prefix dokumen berformat `<KIND>-YYYYMM-` (mis. `PO-202609-`). */
export function numberPrefix(kind: DocumentKind, date: Date): string {
  return `${kind}-${format(date, "yyyyMM")}-`;
}

/** Nomor dokumen unik berformat `<KIND>-YYYYMM-NNN` dari jumlah dokumen yang sudah ada. */
export function buildDocumentNumber(kind: DocumentKind, date: Date, existingCount: number): string {
  return `${numberPrefix(kind, date)}${String(existingCount + 1).padStart(3, "0")}`;
}
