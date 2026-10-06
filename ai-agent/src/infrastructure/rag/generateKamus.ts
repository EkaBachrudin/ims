import { backendGateway } from "../backend/backendGateway";
import { ingestPool } from "../db";
import type { ProductRow } from "../../application/ports/backendGateway";
import { upsertKnowledgeDoc } from "./knowledgeDocStore";
import { runIngest } from "./ingest";

/**
 * Generate dokumen `kamus-produk` dari katalog produk (Backend API), lalu
 * meng-ingest-nya ke `document_chunks`. Idempoten (upsert + content hash).
 */

const PAGE_LIMIT = 100;

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function fetchAllProducts(): Promise<ProductRow[]> {
  const all: ProductRow[] = [];
  let page = 1;
  for (;;) {
    const res = await backendGateway.listProducts({ page, limit: PAGE_LIMIT });
    all.push(...res.data);
    const total = res.meta?.total ?? all.length;
    if (res.data.length === 0 || all.length >= total || page >= 50) break;
    page += 1;
  }
  return all;
}

function buildMarkdown(products: ProductRow[]): string {
  const byCategory = new Map<string, ProductRow[]>();
  for (const p of products) {
    const cat = p.category ?? "Tanpa Kategori";
    const list = byCategory.get(cat) ?? [];
    list.push(p);
    byCategory.set(cat, list);
  }

  const lines = [
    "# Kamus Produk",
    "",
    "Daftar nama produk RESMI (katalog) beserta SKU, kategori, dan satuan. Gunakan nama resmi ini saat membuat PO/Surat Jalan.",
    "",
  ];
  for (const [cat, items] of byCategory) {
    lines.push(`## ${cat}`);
    for (const p of items) {
      lines.push(`- ${p.name} (SKU ${p.sku}, satuan ${p.unit}). Kata kunci: ${normalize(p.name)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  console.log("Generate kamus produk dari katalog...");
  const products = await fetchAllProducts();
  console.log(`  ${products.length} produk ditemukan.`);

  const pool = ingestPool();
  try {
    const { action, id } = await upsertKnowledgeDoc(pool, {
      filename: "kamus-produk.md",
      title: "Kamus Produk",
      docType: "kamus-produk",
      content: buildMarkdown(products),
    });
    console.log(`  ✓ kamus-produk.md: ${action}`);

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
      console.error("Generate kamus gagal:", err);
      process.exit(1);
    });
}
