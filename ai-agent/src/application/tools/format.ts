import type { MatchedNames, Meta, PoListRow } from "../ports/backendGateway";

export const DIRECTION_TO_TYPE: Record<string, "IN" | "OUT" | "ADJUSTMENT"> = {
  masuk: "IN",
  keluar: "OUT",
  penyesuaian: "ADJUSTMENT",
};

export const TYPE_LABEL: Record<string, string> = {
  IN: "MASUK",
  OUT: "KELUAR",
  ADJUSTMENT: "PENYESUAIAN",
};

export function shortDate(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

interface DraftItem {
  quantity: number;
  product: { name: string; unit: string };
}

export function draftItemLines(items?: DraftItem[]): string[] {
  return (items ?? []).map((i) => `• ${i.quantity} ${i.product.unit} ${i.product.name}`);
}

export function unmatchedNote(unmatched?: string[]): string {
  return unmatched?.length ? `\nCatatan: tidak ditemukan ${unmatched.join(", ")}.` : "";
}

export function matchedNote(matched?: MatchedNames): string {
  if (!matched) return "";
  const parts: string[] = [];
  if (matched.products?.length) parts.push(`produk: ${matched.products.join(", ")}`);
  if (matched.warehouses?.length) parts.push(`gudang: ${matched.warehouses.join(", ")}`);
  if (matched.partners?.length) parts.push(`partner: ${matched.partners.join(", ")}`);
  return parts.length ? `\nFilter cocok → ${parts.join(" | ")}` : "";
}

export function formatPoList(
  data: PoListRow[],
  meta: Meta | undefined,
  matched: MatchedNames | undefined,
  unmatched: string[] | undefined,
): string {
  if (data.length === 0)
    return `Tidak ada PO yang cocok dengan filter tersebut.${unmatchedNote(unmatched)}`;
  const lines = data.flatMap((po) => {
    const created = shortDate(po.createdAt) ?? po.createdAt;
    const target = shortDate(po.targetDate);
    return [
      `• ${po.poNumber} [${po.status}] — ${po.partner}`,
      ...po.items.map((i) => `  – ${i.quantity} ${i.unit} ${i.product}`),
      `  Dibuat ${created}${target ? ` — target ${target}` : ""}`,
    ];
  });
  return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} PO.${matchedNote(matched)}${unmatchedNote(unmatched)}`;
}
