import { env } from "../config/env";
import { db } from "../db";
import { getEmbeddings } from "./embeddings";

export interface KnowledgeChunk {
  source: string;
  content: string;
  score: number;
}

/** Retrieval top-K dari document_chunks (read-only, cosine distance). */
export async function searchKnowledge(query: string, topK = env.AGENT_TOP_K): Promise<KnowledgeChunk[]> {
  const [vector] = await getEmbeddings().embedDocuments([query]);
  const { rows } = await db.query(
    `SELECT source, content, 1 - (embedding <=> $1::vector) AS score
     FROM document_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(vector), topK],
  );
  return rows as KnowledgeChunk[];
}
