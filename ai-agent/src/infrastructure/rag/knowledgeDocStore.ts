import { ingestPool } from "../db";

export interface UpsertDocInput {
  filename: string;
  title: string;
  docType: string;
  content: string;
}

/**
 * Upsert dokumen ke `knowledge_documents` (source of truth). Idempoten:
 * bila `filename` sudah ada, isinya diperbarui dan `version` dinaikkan.
 */
export interface UpsertDocResult {
  action: "insert" | "update";
  id: string;
}

export async function upsertKnowledgeDoc(
  pool: ReturnType<typeof ingestPool>,
  input: UpsertDocInput,
): Promise<UpsertDocResult> {
  const existing = await pool.query<{ id: string }>(
    `SELECT "id" FROM "knowledge_documents" WHERE "filename" = $1 LIMIT 1`,
    [input.filename],
  );

  if (existing.rows[0]) {
    const updated = await pool.query<{ id: string }>(
      `UPDATE "knowledge_documents"
         SET "title" = $2, "docType" = $3, "content" = $4,
             "version" = "version" + 1, "isActive" = true, "updatedAt" = now()
       WHERE "id" = $1
       RETURNING "id"`,
      [existing.rows[0].id, input.title, input.docType, input.content],
    );
    return { action: "update", id: updated.rows[0].id };
  }

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO "knowledge_documents"
       ("id", "filename", "title", "docType", "content", "version", "isActive", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, true, now(), now())
     RETURNING "id"`,
    [input.filename, input.title, input.docType, input.content],
  );
  return { action: "insert", id: inserted.rows[0].id };
}
