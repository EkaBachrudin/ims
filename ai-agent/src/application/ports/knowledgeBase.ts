export interface KnowledgeChunk {
  source: string;
  content: string;
  score: number;
}

/** Kontrak retrieval knowledge base (SOP) untuk tool RAG. */
export interface KnowledgeBase {
  search(query: string, topK?: number): Promise<KnowledgeChunk[]>;
}
