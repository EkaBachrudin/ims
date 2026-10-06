import { env } from "../../config/env";
import { Errors } from "../../lib/errors";
import type {
  IngestFilter,
  IngestJobState,
  KnowledgeIndexer,
} from "../../application/ports/knowledgeIndexer";

function base(url: string): string {
  return url.replace(/\/+$/, "");
}

async function request(path: string, init?: RequestInit): Promise<IngestJobState> {
  if (!env.AI_AGENT_URL) {
    throw Errors.internal("AI_AGENT_URL belum dikonfigurasi");
  }
  const res = await fetch(`${base(env.AI_AGENT_URL)}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-internal-key": env.INTERNAL_API_KEY,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await res.json().catch(() => null)) as
    | { success: true; data: IngestJobState }
    | { success: false; error?: { message?: string } }
    | null;

  if (!res.ok || !payload || payload.success === false) {
    const message =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : `AI Agent merespons status ${res.status}`;
    throw Errors.internal(message);
  }
  return payload.data;
}

/** Adapter: memicu re-ingest knowledge base melalui AI Agent (HTTP internal). */
export const aiAgentIndexer: KnowledgeIndexer = {
  triggerIngest(filter?: IngestFilter) {
    return request("/ingest", { method: "POST", body: JSON.stringify(filter ?? {}) });
  },
  getStatus() {
    return request("/ingest/status", { method: "GET" });
  },
};
