export type IngestJobStatus = "idle" | "running" | "done" | "error";

export interface IngestJobResult {
  documentId: string;
  source: string;
  chunks: number;
  skipped: boolean;
}

export interface IngestJobState {
  status: IngestJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  results: IngestJobResult[];
  error: string | null;
}

export interface IngestFilter {
  documentId?: string;
  docType?: string;
}

/** Port untuk memicu & memantau re-ingest knowledge base di AI Agent. */
export interface KnowledgeIndexer {
  triggerIngest(filter?: IngestFilter): Promise<IngestJobState>;
  getStatus(): Promise<IngestJobState>;
}
