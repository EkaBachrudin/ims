export type IngestJobStatus = "idle" | "running" | "done" | "error";

export interface IngestFilter {
  documentId?: string;
  docType?: string;
}

export interface IngestResult {
  documentId: string;
  source: string;
  chunks: number;
  skipped: boolean;
}

export interface IngestJobState {
  status: IngestJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  results: IngestResult[];
  error: string | null;
}

/** Port pengendali re-ingest knowledge base (dipakai presentation/HTTP). */
export interface IngestRunner {
  start(filter?: IngestFilter): IngestJobState;
  status(): IngestJobState;
}
