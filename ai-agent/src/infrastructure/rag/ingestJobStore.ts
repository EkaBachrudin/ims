import type { Pool } from "pg";
import type { IngestFilter, IngestResult } from "../../application/ports/ingest";
import { runIngest } from "./ingest";

/**
 * Persistensi riwayat job ingest ke tabel `ingest_jobs`. Menjadi satu sumber
 * kebenaran agar tab Index ("Ingest terakhir") dan tab Ingest (Mulai/Selesai)
 * menampilkan nilai yang sama, termasuk setelah AI Agent restart.
 */
export interface PersistedIngestJob {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  results: IngestResult[];
}

async function createJob(pool: Pool, filter: IngestFilter): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO "ingest_jobs" ("id", "status", "filter", "startedAt", "createdAt")
     VALUES (gen_random_uuid(), 'running', $1, now(), now())
     RETURNING "id"`,
    [JSON.stringify(filter)],
  );
  return res.rows[0].id;
}

async function finishJob(
  pool: Pool,
  id: string,
  status: "done" | "error",
  results: IngestResult[],
  error: string | null,
): Promise<void> {
  await pool.query(
    `UPDATE "ingest_jobs"
        SET "status" = $2, "finishedAt" = now(), "results" = $3, "error" = $4
      WHERE "id" = $1`,
    [id, status, JSON.stringify(results), error],
  );
}

/**
 * Jalankan ingest sekaligus mencatat lifecycle-nya (running → done/error).
 * `runIngest` tetap murni; pencatatan job diletakkan di wrapper ini sehingga
 * jalur HTTP maupun CLI (`make rag-ingest`) sama-sama terekam.
 */
export async function runIngestJob(
  pool: Pool,
  filter: IngestFilter = {},
): Promise<IngestResult[]> {
  const jobId = await createJob(pool, filter);
  try {
    const results = await runIngest(pool, filter);
    await finishJob(pool, jobId, "done", results, null);
    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishJob(pool, jobId, "error", [], message).catch(() => undefined);
    throw err;
  }
}

export async function loadLatestJob(pool: Pool): Promise<PersistedIngestJob | null> {
  const res = await pool.query<{
    id: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    error: string | null;
    results: unknown;
  }>(
    `SELECT "id", "status", "startedAt", "finishedAt", "error", "results"
       FROM "ingest_jobs"
      ORDER BY "startedAt" DESC
      LIMIT 1`,
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    error: row.error ?? null,
    results: Array.isArray(row.results) ? (row.results as IngestResult[]) : [],
  };
}

/** Tandai job yang masih `running` sebagai error (proses sebelumnya terputus). */
export async function markJobInterrupted(
  pool: Pool,
  id: string,
  reason = "Job terputus (AI Agent restart)",
): Promise<void> {
  await pool.query(
    `UPDATE "ingest_jobs"
        SET "status" = 'error', "finishedAt" = now(), "error" = $2
      WHERE "id" = $1 AND "status" = 'running'`,
    [id, reason],
  );
}
