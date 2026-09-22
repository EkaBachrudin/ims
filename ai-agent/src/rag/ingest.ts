import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { env } from "../config/env";
import { ingestPool } from "../db";
import { getEmbeddings } from "./embeddings";

const KNOWLEDGE_DIR = join(__dirname, "../../docs/knowledge");

async function ingestText(
  pool: ReturnType<typeof ingestPool>,
  source: string,
  raw: string,
): Promise<number> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: env.CHUNK_SIZE,
    chunkOverlap: env.CHUNK_OVERLAP,
  });
  const chunks = await splitter.createDocuments([raw], [{ source }]);
  const vectors = await getEmbeddings().embedDocuments(chunks.map((c) => c.pageContent));

  await pool.query("DELETE FROM document_chunks WHERE source = $1", [source]);
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `INSERT INTO document_chunks (id, source, content, embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, now())`,
      [source, chunks[i].pageContent, JSON.stringify(vectors[i])],
    );
  }
  return chunks.length;
}

export async function ingestAll(): Promise<{ source: string; chunks: number }[]> {
  const pool = ingestPool();
  const results: { source: string; chunks: number }[] = [];
  try {
    const files = (await readdir(KNOWLEDGE_DIR)).filter((f) =>
      [".md", ".txt"].includes(extname(f).toLowerCase()),
    );
    if (files.length === 0) {
      console.warn(`Tidak ada dokumen di ${KNOWLEDGE_DIR}`);
      return results;
    }
    for (const file of files) {
      const raw = await readFile(join(KNOWLEDGE_DIR, file), "utf8");
      const count = await ingestText(pool, file, raw);
      results.push({ source: file, chunks: count });
      console.log(`  ✓ ${file}: ${count} chunk`);
    }
  } finally {
    await pool.end();
  }
  return results;
}

async function main() {
  console.log("Mulai ingest knowledge base...");
  const results = await ingestAll();
  const total = results.reduce((sum, r) => sum + r.chunks, 0);
  console.log(`Selesai. Total ${total} chunk dari ${results.length} dokumen.`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Ingest gagal:", err);
    process.exit(1);
  });
}
