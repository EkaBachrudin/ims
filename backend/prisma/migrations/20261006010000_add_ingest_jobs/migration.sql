-- Riwayat job re-ingest knowledge base (`ingest_jobs`). Ditulis oleh proses
-- ingest AI Agent (kredensial write) dan dibaca backend untuk menampilkan
-- "ingest terakhir" yang konsisten di tab Index maupun Ingest.

CREATE TABLE "ingest_jobs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filter" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ingest_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingest_jobs_startedAt_idx" ON "ingest_jobs"("startedAt");
