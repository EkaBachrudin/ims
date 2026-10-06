import { ingestPool } from "../db";
import { runIngest } from "./ingest";
import type {
  IngestFilter,
  IngestJobState,
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
      state.results = await runIngest(pool, filter);
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
