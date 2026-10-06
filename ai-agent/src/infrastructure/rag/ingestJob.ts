import { ingestPool } from "../db";
import { env } from "../../config/env";
import {
  loadLatestJob,
  markJobInterrupted,
  runIngestJob,
} from "./ingestJobStore";
import type {
  IngestFilter,
  IngestJobState,
  IngestJobStatus,
  IngestRunner,
} from "../../application/ports/ingest";

const state: IngestJobState = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  results: [],
  error: null,
};

function getStatus(): IngestJobState {
  return { ...state, results: [...state.results] };
}

/**
 * Muat job terakhir dari DB agar status tetap tampil setelah AI Agent restart
 * (state in-memory hilang). Job yang masih `running` ditandai terputus.
 */
async function hydrate(): Promise<void> {
  if (state.status !== "idle") return;
  const pool = ingestPool();
  try {
    const job = await loadLatestJob(pool);
    if (!job) return;
    if (job.status === "running") {
      await markJobInterrupted(pool, job.id);
      job.status = "error";
      job.error = job.error ?? "Job terputus (AI Agent restart)";
      job.finishedAt = job.finishedAt ?? new Date().toISOString();
    }
    // Jangan menimpa bila start() sudah berjalan selagi menunggu query.
    if (state.status !== "idle") return;
    state.status = job.status as IngestJobStatus;
    state.startedAt = job.startedAt;
    state.finishedAt = job.finishedAt;
    state.error = job.error;
    state.results = job.results;
  } catch (err) {
    console.warn("Gagal memuat riwayat ingest:", err instanceof Error ? err.message : err);
  } finally {
    await pool.end();
  }
}

/**
 * Jalankan ingest secara asinkron (non-blocking). Hanya satu job boleh berjalan
 * pada satu waktu; pemanggil berikutnya saat masih `running` akan ditolak.
 */
function start(filter: IngestFilter = {}): IngestJobState {
  if (state.status === "running") {
    throw new Error("Ingest sedang berjalan");
  }

  state.status = "running";
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.results = [];
  state.error = null;

  void (async () => {
    const pool = ingestPool();
    try {
      state.results = await runIngestJob(pool, filter);
      state.status = "done";
    } catch (err) {
      state.status = "error";
      state.error = err instanceof Error ? err.message : String(err);
      console.error("Ingest job gagal:", err);
    } finally {
      state.finishedAt = new Date().toISOString();
      await pool.end();
    }
  })();

  return getStatus();
}

export const ingestJob: IngestRunner = { start, status: getStatus };

if (env.NODE_ENV !== "test") {
  void hydrate();
}
