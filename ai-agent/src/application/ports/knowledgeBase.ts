export interface KnowledgeChunk {
  source: string;
  title: string | null;
  docType: string | null;
  content: string;
  score: number;
}

export interface KnowledgeSearchOptions {
  /** Jumlah chunk teratas. Default `AGENT_TOP_K`. */
  topK?: number;
  /** Ambang skor cosine minimal (0-1). Default `RAG_MIN_SCORE`. */
  minScore?: number;
  /** Batasi ke `docType` tertentu (mis. "kebijakan", "kamus-produk"). */
  docTypes?: string[];
}

/** Kontrak retrieval knowledge base (RAG) untuk tool agent. */
export interface KnowledgeBase {
  search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeChunk[]>;
}
