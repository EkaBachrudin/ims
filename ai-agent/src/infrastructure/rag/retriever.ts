import { env } from "../../config/env";
import { db } from "../db";
import { getEmbeddings } from "./embeddings";
import type { KnowledgeChunk, KnowledgeSearchOptions } from "../../application/ports/knowledgeBase";

interface RawChunk extends KnowledgeChunk {
  vectorMatch?: boolean;
  textMatch?: boolean;
}

/** Retrieval top-K dari `document_chunks` (read-only). Hybrid vector + full-text (RRF). */
export async function searchKnowledge(
  query: string,
  options: KnowledgeSearchOptions = {},
): Promise<KnowledgeChunk[]> {
  const topK = options.topK ?? env.AGENT_TOP_K;
  const minScore = options.minScore ?? env.RAG_MIN_SCORE;
  const docTypes = options.docTypes && options.docTypes.length > 0 ? options.docTypes : null;

  try {
    const vector = await getEmbeddings().embedQuery(query);
    const vectorParam = JSON.stringify(vector);

    const rows = env.RAG_HYBRID
      ? await hybridSearch(vectorParam, query, topK, docTypes)
      : await vectorSearch(vectorParam, topK, docTypes);

    return rows
      .filter((r) => (env.RAG_HYBRID ? r.vectorMatch === false || r.score >= minScore : r.score >= minScore))
      .map(({ source, title, docType, content, score }) => ({ source, title, docType, content, score }));
  } catch (err) {
    console.error("Retrieval knowledge base gagal:", err);
    return [];
  }
}

async function vectorSearch(
  vectorParam: string,
  topK: number,
  docTypes: string[] | null,
): Promise<RawChunk[]> {
  const { rows } = await db.query(
    `SELECT source, title, "docType" AS "docType", content,
            1 - (embedding <=> $1::vector) AS score
     FROM document_chunks
     WHERE ($3::text[] IS NULL OR "docType" = ANY($3))
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorParam, topK, docTypes],
  );
  return rows as RawChunk[];
}

async function hybridSearch(
  vectorParam: string,
  query: string,
  topK: number,
  docTypes: string[] | null,
): Promise<RawChunk[]> {
  const { rows } = await db.query(
    `WITH vector_rank AS (
       SELECT id,
              ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank,
              1 - (embedding <=> $1::vector) AS score
       FROM document_chunks
       WHERE ($3::text[] IS NULL OR "docType" = ANY($3))
       ORDER BY embedding <=> $1::vector
       LIMIT $2
     ),
     text_rank AS (
       SELECT id,
              ROW_NUMBER() OVER (
                ORDER BY ts_rank("content_tsv", plainto_tsquery('simple', $4)) DESC
              ) AS rank
       FROM document_chunks
       WHERE ($3::text[] IS NULL OR "docType" = ANY($3))
         AND "content_tsv" @@ plainto_tsquery('simple', $4)
       ORDER BY ts_rank("content_tsv", plainto_tsquery('simple', $4)) DESC
       LIMIT $2
     )
     SELECT c.source, c.title, c."docType" AS "docType", c.content,
            COALESCE(v.score, 0) AS score,
            (v.id IS NOT NULL) AS "vectorMatch",
            (t.id IS NOT NULL) AS "textMatch"
     FROM document_chunks c
     LEFT JOIN vector_rank v ON v.id = c.id
     LEFT JOIN text_rank t ON t.id = c.id
     WHERE v.id IS NOT NULL OR t.id IS NOT NULL
     ORDER BY (COALESCE(1.0 / (60 + v.rank), 0) + COALESCE(1.0 / (60 + t.rank), 0)) DESC,
              score DESC
     LIMIT $2`,
    [vectorParam, topK, docTypes, query],
  );
  return rows as RawChunk[];
}
