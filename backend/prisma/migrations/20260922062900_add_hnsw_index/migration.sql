-- Index vektor HNSW untuk retrieval RAG (pgvector >= 0.5.0).
-- Prisma tidak dapat mendeklarasikan index ini via schema, jadi dibuat manual.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
