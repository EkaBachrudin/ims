import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { env } from "../../config/env";
import { ingestPool } from "../db";
import { getEmbeddings } from "./embeddings";
import { runIngestJob } from "./ingestJobStore";
import type { IngestFilter, IngestResult } from "../../application/ports/ingest";

interface KnowledgeDoc {
  id: string;
  filename: string;
  title: string;
  docType: string;
  content: string;
  metadata: unknown;
  version: number;
}

function hashDoc(doc: KnowledgeDoc): string {
  const payload = JSON.stringify({
    content: doc.content,
    title: doc.title,
    docType: doc.docType,
    metadata: doc.metadata ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Bersihkan chunk yatim: milik dokumen yang sudah nonaktif (soft delete) atau
 * sudah tidak ada. Dijalankan setiap ingest agar index RAG selalu selaras
 * dengan dokumen aktif — termasuk saat re-ingest "semua" maupun per dokumen.
 */
export async function pruneOrphanChunks(pool: ReturnType<typeof ingestPool>): Promise<number> {
  const res = await pool.query(
    `DELETE FROM "document_chunks" c
     WHERE c."documentId" IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "knowledge_documents" kd
         WHERE kd."id" = c."documentId" AND kd."isActive" = true
       )`,
  );
  return res.rowCount ?? 0;
}

function splitDocument(title: string, content: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: env.CHUNK_SIZE,
    chunkOverlap: env.CHUNK_OVERLAP,
    separators: ["\n## ", "\n### ", "\n# ", "\n\n", "\n", " "],
  });
  return splitter
    .createDocuments([`# ${title}\n\n${content}`])
    .then((docs) => docs.map((d) => d.pageContent));
}

/**
 * Ingest dokumen knowledge base (source of truth: tabel `knowledge_documents`)
 * ke `document_chunks`. Pool disediakan pemanggil (job/CLI) agar lifecycle jelas.
 */
export async function runIngest(
  pool: ReturnType<typeof ingestPool>,
  filter: IngestFilter = {},
): Promise<IngestResult[]> {
  const pruned = await pruneOrphanChunks(pool);
  if (pruned > 0) {
    console.log(`  ↳ prune: ${pruned} chunk yatim dihapus.`);
  }

  const conditions: string[] = [`"isActive" = true`];
  const params: unknown[] = [];
  if (filter.documentId) {
    params.push(filter.documentId);
    conditions.push(`"id" = $${params.length}`);
  }
  if (filter.docType) {
    params.push(filter.docType);
    conditions.push(`"docType" = $${params.length}`);
  }

  const { rows } = await pool.query<KnowledgeDoc>(
    `SELECT "id", "filename", "title", "docType", "content", "metadata", "version"
     FROM "knowledge_documents" WHERE ${conditions.join(" AND ")}`,
    params,
  );

  const embeddings = getEmbeddings();
  const results: IngestResult[] = [];

  for (const doc of rows) {
    const contentHash = hashDoc(doc);
    const existing = await pool.query(
      `SELECT 1 FROM "document_chunks" WHERE "documentId" = $1 AND "contentHash" = $2 LIMIT 1`,
      [doc.id, contentHash],
    );
    if ((existing.rowCount ?? 0) > 0) {
      results.push({ documentId: doc.id, source: doc.filename, chunks: 0, skipped: true });
      continue;
    }

    const chunks = await splitDocument(doc.title, doc.content);
    const vectors = await embeddings.embedDocuments(chunks);

    await pool.query("BEGIN");
    try {
      await pool.query(`DELETE FROM "document_chunks" WHERE "documentId" = $1`, [doc.id]);
      for (let i = 0; i < chunks.length; i++) {
        await pool.query(
          `INSERT INTO "document_chunks"
             ("id", "source", "content", "embedding", "documentId", "docType", "title",
              "metadata", "contentHash", "embeddingModel", "dimensions", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
          [
            doc.filename,
            chunks[i],
            JSON.stringify(vectors[i]),
            doc.id,
            doc.docType,
            doc.title,
            doc.metadata ? JSON.stringify(doc.metadata) : null,
            contentHash,
            env.OPENAI_EMBEDDING_MODEL,
            env.EMBEDDING_DIMENSIONS,
          ],
        );
      }
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }

    results.push({ documentId: doc.id, source: doc.filename, chunks: chunks.length, skipped: false });
  }

  return results;
}

async function main() {
  console.log("Mulai ingest knowledge base (dari tabel knowledge_documents)...");
  const pool = ingestPool();
  try {
    const results = await runIngestJob(pool);
    const total = results.reduce((sum, r) => sum + r.chunks, 0);
    console.log(`Selesai. Total ${total} chunk dari ${results.length} dokumen.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Ingest gagal:", err);
      process.exit(1);
    });
}
