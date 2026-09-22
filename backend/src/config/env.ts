import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET wajib diisi"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET wajib diisi"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  INTERNAL_API_KEY: z.string().min(1, "INTERNAL_API_KEY wajib diisi"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Konfigurasi environment tidak valid:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
