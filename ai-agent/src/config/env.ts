import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),

  BACKEND_API_URL: z.string().default("http://localhost:3001/api"),
  INTERNAL_API_KEY: z.string().default("change_me_internal"),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),

  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_REASONING_EFFORT: z.enum(["none", "low", "medium", "high"]).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  LLM_TEMPERATURE: z.coerce.number().default(0),

  AGENT_TOP_K: z.coerce.number().default(12),
  MAX_HISTORY_TURNS: z.coerce.number().default(20),
  CHUNK_SIZE: z.coerce.number().default(1000),
  CHUNK_OVERLAP: z.coerce.number().default(200),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("wms_db"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  // Kredensial tulis khusus proses ingest (opsional; default ke DB_*)
  INGEST_DB_USER: z.string().optional(),
  INGEST_DB_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Konfigurasi environment ai-agent tidak valid:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

export function requireOpenAIKey(): string {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY belum diisi di ai-agent/.env");
  }
  return env.OPENAI_API_KEY;
}

export function requireTelegramToken(): string {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diisi di ai-agent/.env");
  }
  return env.TELEGRAM_BOT_TOKEN;
}
