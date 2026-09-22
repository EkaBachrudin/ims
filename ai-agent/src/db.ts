import { Pool } from "pg";
import { env } from "./config/env";

/**
 * Koneksi READ-ONLY ke tabel vector `document_chunks` (RAG retrieval).
 * Runtime hanya melakukan SELECT; gunakan user DB dengan hak terbatas.
 */
export const db = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 5,
});

/** Pool terpisah dengan hak tulis, hanya dipakai proses ingest offline. */
export function ingestPool(): Pool {
  return new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.INGEST_DB_USER ?? env.DB_USER,
    password: env.INGEST_DB_PASSWORD ?? env.DB_PASSWORD,
    max: 2,
  });
}
