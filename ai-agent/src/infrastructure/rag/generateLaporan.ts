import { backendGateway } from "../backend/backendGateway";
import { ingestPool } from "../db";
import type { TransactionRow } from "../../application/ports/backendGateway";
import { upsertKnowledgeDoc } from "./knowledgeDocStore";
import { runIngest } from "./ingest";

/**
 * Generate laporan naratif periode berjalan dari Backend API (dashboard +
 * transaksi), lalu meng-ingest-nya sebagai dokumen `laporan`.
 */

function currentPeriod(): { first: string; last: string; label: string; key: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const last = now.toISOString().slice(0, 10);
  const label = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return { first, last, label, key: `${y}-${String(m + 1).padStart(2, "0")}` };
}

function sumQty(rows: TransactionRow[]): number {
  return rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
}

function topPartners(rows: TransactionRow[], limit = 5): string[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.partner) continue;
    totals.set(r.partner, (totals.get(r.partner) ?? 0) + (r.quantity ?? 0));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([partner, qty]) => `- ${partner}: ${qty} unit`);
}

async function main() {
  console.log("Generate laporan operasional periode berjalan...");
  const period = currentPeriod();

  const [dashboard, inbound, outbound] = await Promise.all([
    backendGateway.getDashboard(),
    backendGateway.listTransactions({ type: "IN", from: period.first, to: period.last, limit: 100 }),
    backendGateway.listTransactions({ type: "OUT", from: period.first, to: period.last, limit: 100 }),
  ]);

  const inQty = sumQty(inbound.data);
  const outQty = sumQty(outbound.data);
  const top = topPartners(outbound.data);

  const content = [
    `# Laporan Operasional ${period.label}`,
    "",
    `Periode: ${period.first} s/d ${period.last}.`,
    "",
    "## Ringkasan",
    `- Total produk: ${dashboard.totalProducts}`,
    `- PO aktif: ${dashboard.activePOs}`,
    `- Barang masuk: ${inQty} unit (${inbound.data.length} transaksi)`,
    `- Barang keluar: ${outQty} unit (${outbound.data.length} transaksi)`,
    `- Produk stok tipis: ${dashboard.lowStockCount}`,
    "",
    "## Pengiriman terbanyak",
    top.length ? top.join("\n") : "- Belum ada pengiriman pada periode ini.",
    "",
    "## Catatan",
    `Angka diambil dari transaksi tercatat hingga ${period.last}.`,
    "",
  ].join("\n");

  const pool = ingestPool();
  try {
    const { action, id } = await upsertKnowledgeDoc(pool, {
      filename: `laporan-${period.key}.md`,
      title: `Laporan Operasional ${period.label}`,
      docType: "laporan",
      content,
    });
    console.log(`  ✓ laporan-${period.key}.md: ${action}`);

    const results = await runIngest(pool, { documentId: id });
    console.log(`  ✓ ingest: ${results[0]?.chunks ?? 0} chunk`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Generate laporan gagal:", err);
      process.exit(1);
    });
}
