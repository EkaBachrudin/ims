-- Knowledge base source of truth (`knowledge_documents`) + kolom metadata pada
-- `document_chunks`. Kolom generated `content_tsv` dan index GIN dibuat manual
-- karena Prisma tidak dapat mendeklarasikannya via schema (lihat schema.prisma).

CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'sop',
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_documents_docType_idx" ON "knowledge_documents"("docType");
CREATE INDEX "knowledge_documents_isActive_idx" ON "knowledge_documents"("isActive");

ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_chunks"
  ADD COLUMN "documentId" TEXT,
  ADD COLUMN "docType" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "embeddingModel" TEXT,
  ADD COLUMN "dimensions" INTEGER,
  ADD COLUMN "content_tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "content")) STORED;

CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX "document_chunks_content_tsv_idx" ON "document_chunks" USING gin ("content_tsv");

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
