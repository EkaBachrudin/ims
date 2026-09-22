import { OpenAIEmbeddings } from "@langchain/openai";
import { env, requireOpenAIKey } from "../config/env";

let cached: OpenAIEmbeddings | null = null;

/** Lazy init agar import modul tidak gagal saat kunci belum tersedia (mis. unit test). */
export function getEmbeddings(): OpenAIEmbeddings {
  if (!cached) {
    cached = new OpenAIEmbeddings({
      model: env.OPENAI_EMBEDDING_MODEL,
      dimensions: env.EMBEDDING_DIMENSIONS,
      apiKey: requireOpenAIKey(),
    });
  }
  return cached;
}
