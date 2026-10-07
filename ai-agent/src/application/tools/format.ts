import type {
  DnRow,
  LowStockRow,
  MatchedNames,
  Meta,
  PoListRow,
  ProductRow,
  TransactionRow,
} from "../ports/backendGateway";

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

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function shortDate(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function parseIdDate(value: string): { day: string; month: string; year: string } | null {
  const [year, month, day] = value.slice(0, 10).split("-");
  const monthLabel = MONTHS_ID[Number(month) - 1];
  if (!year || !month || !day || !monthLabel) return null;
  return { day: String(Number(day)), month: monthLabel, year };
}

/** "2026-10-04 08:00" -> "4 Okt 2026". */
export function formatIdDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = parseIdDate(value);
  return parsed ? `${parsed.day} ${parsed.month} ${parsed.year}` : shortDate(value);
}

/** "2026-10-04 08:00" -> "4 Okt" (untuk header grup tanggal). */
export function formatIdDay(value?: string | null): string | null {
  if (!value) return null;
  const parsed = parseIdDate(value);
  return parsed ? `${parsed.day} ${parsed.month}` : shortDate(value);
}

/**
 * Kelompokkan baris berdasarkan tanggal harian tanpa mengubah urutan asli:
 * tanggal yang sama tetap digabung meski letaknya tidak berurutan.
 */
export function groupByDate<T>(rows: T[], getDate: (row: T) => string | null): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const day = getDate(row) ?? "";
    const bucket = groups.get(day);
    if (bucket) bucket.push(row);
    else groups.set(day, [row]);
  }
  return [...groups.entries()];
}

/** Catatan saat data yang ditampilkan lebih sedikit dari total. */
export function shownNote(shown: number, total: number | undefined, label: string): string {
  if (!total || total <= shown) return "";
  return `menampilkan ${shown} dari ${total} ${label}`;
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
  return parts.length ? `\nFilter cocok → ${parts.join(" · ")}` : "";
}

function footer(parts: (string | null)[]): string {
  const items = parts.filter((p): p is string => Boolean(p));
  return items.length ? `\n${items.join(" · ")}.` : "";
}

/** Kartu transaksi dikelompokkan per tanggal. */
export function formatTransactionList(
  data: TransactionRow[],
  meta: Meta | undefined,
  matched: MatchedNames | undefined,
  unmatched: string[] | undefined,
): string {
  if (data.length === 0)
    return `Tidak ada transaksi yang cocok dengan filter tersebut.${unmatchedNote(unmatched)}`;

  const warehouses = [...new Set(data.map((r) => r.warehouse))];
  const showWarehousePerRow = warehouses.length > 1;

  const blocks = groupByDate(data, (r) => r.date.slice(0, 10)).map(([day, rows]) => {
    const cards = rows.map((r) => {
      const detail: string[] = [TYPE_LABEL[r.type] ?? r.type];
      detail.push(`${r.quantity} ${r.unit}${r.partner ? ` → ${r.partner}` : ""}`);
      if (showWarehousePerRow) detail.push(`(${r.warehouse})`);
      if (r.poNumber) detail.push(`PO ${r.poNumber}`);
      return `• **${r.product}**\n  ${detail.join(" · ")}`;
    });
    return `**${formatIdDay(day) ?? day}**\n${cards.join("\n")}`;
  });

  const total = meta?.total ?? data.length;
  return `${blocks.join("\n\n")}${footer([
    `Total: ${total} transaksi`,
    !showWarehousePerRow && warehouses.length === 1 ? `gudang ${warehouses[0]}` : null,
    shownNote(data.length, meta?.total, "transaksi"),
  ])}${matchedNote(matched)}${unmatchedNote(unmatched)}`;
}

/** Kartu Purchase Order. */
export function formatPoList(
  data: PoListRow[],
  meta: Meta | undefined,
  matched: MatchedNames | undefined,
  unmatched: string[] | undefined,
): string {
  if (data.length === 0)
    return `Tidak ada PO yang cocok dengan filter tersebut.${unmatchedNote(unmatched)}`;

  const blocks = data.map((po) => {
    const items = po.items.map((i) => `  – ${i.quantity} ${i.unit} ${i.product}`).join("\n");
    const created = formatIdDate(po.createdAt) ?? po.createdAt;
    const target = formatIdDate(po.targetDate);
    const detail = [`dibuat ${created}`, target ? `target ${target}` : null]
      .filter((p): p is string => Boolean(p))
      .join(" · ");
    return `**${po.poNumber}** · ${po.status} — ${po.partner}\n${items}\n  ${detail}`;
  });

  const total = meta?.total ?? data.length;
  return `${blocks.join("\n\n")}${footer([
    `Total: ${total} PO`,
    shownNote(data.length, meta?.total, "PO"),
  ])}${matchedNote(matched)}${unmatchedNote(unmatched)}`;
}

/** Kartu Surat Jalan / Delivery Note. */
export function formatDnList(
  data: DnRow[],
  meta: Meta | undefined,
  matched: MatchedNames | undefined,
  unmatched: string[] | undefined,
): string {
  if (data.length === 0) return `Tidak ada surat jalan yang cocok.${unmatchedNote(unmatched)}`;

  const blocks = data.map((dn) => {
    const items = dn.items.map((i) => `  – ${i.quantity} ${i.unit} ${i.product}`).join("\n");
    const ship = formatIdDate(dn.shipDate) ?? dn.shipDate;
    const detail = [`kirim ${ship}`, dn.poNumber ? `PO ${dn.poNumber}` : null]
      .filter((p): p is string => Boolean(p))
      .join(" · ");
    return `**${dn.dnNumber}** · ${dn.status} — ${dn.partner}\n${items}\n  ${detail}`;
  });

  const total = meta?.total ?? data.length;
  return `${blocks.join("\n\n")}${footer([
    `Total: ${total} surat jalan`,
    shownNote(data.length, meta?.total, "surat jalan"),
  ])}${matchedNote(matched)}${unmatchedNote(unmatched)}`;
}

/** Kartu katalog produk. */
export function formatProductList(data: ProductRow[], meta: Meta | undefined): string {
  if (data.length === 0) return "Tidak ada produk yang cocok.";

  const cards = data.map((p) => {
    const detail = [`stok ${p.stock} ${p.unit}`, `SKU ${p.sku}`];
    if (p.category) detail.push(p.category);
    if (p.lowStock) detail.push("stok tipis");
    return `• **${p.name}**\n  ${detail.join(" · ")}`;
  });

  const total = meta?.total ?? data.length;
  return `${cards.join("\n")}${footer([
    `Total: ${total} produk`,
    shownNote(data.length, meta?.total, "produk"),
  ])}`;
}

/** Kartu produk stok tipis, diurutkan paling kritis (rasio stok/minimum terkecil) dulu. */
export function formatLowStockList(rows: LowStockRow[]): string {
  if (rows.length === 0) return "Tidak ada produk dengan stok tipis.";

  const sorted = [...rows].sort((a, b) => {
    const ratioA = a.minStock > 0 ? a.stock / a.minStock : Number.POSITIVE_INFINITY;
    const ratioB = b.minStock > 0 ? b.stock / b.minStock : Number.POSITIVE_INFINITY;
    return ratioA - ratioB || a.name.localeCompare(b.name);
  });

  const cards = sorted.map((p) => {
    const deficit = Math.max(0, p.minStock - p.stock);
    return `• **${p.name}**\n  stok ${p.stock} ${p.unit} · min ${p.minStock} · kurang ${deficit} · SKU ${p.sku}`;
  });

  return `**Stok tipis (${sorted.length} produk):**\n${cards.join("\n")}`;
}
