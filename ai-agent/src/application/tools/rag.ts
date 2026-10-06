import { DynamicStructuredTool } from "@langchain/core/tools";
import { env } from "../../config/env";
import type { KnowledgeBase, KnowledgeChunk } from "../ports/knowledgeBase";
import { KNOWLEDGE_DOC_TYPES, type SopInput, sopSchema } from "./schemas";

export interface RagToolDeps {
  knowledge: KnowledgeBase;
}

/** Jenis dokumen sensitif: hanya OWNER/SUPER_ADMIN. */
const SENSITIVE_DOC_TYPES = ["catatan-partner", "kontrak"];

function allowedDocTypes(role?: string | null): string[] {
  const all = [...KNOWLEDGE_DOC_TYPES];
  if (role === "OWNER" || role === "SUPER_ADMIN") return all;
  return all.filter((t) => !SENSITIVE_DOC_TYPES.includes(t));
}

function formatChunks(chunks: KnowledgeChunk[], fallback: string): string {
  if (chunks.length === 0) return fallback;
  return chunks
    .map((c, i) => `[${i + 1}] (${c.title ? `${c.title} — ` : ""}${c.source}) ${c.content}`)
    .join("\n\n");
}

function search(knowledge: KnowledgeBase, query: string, docTypes: string[]) {
  return knowledge.search(query, {
    topK: env.AGENT_TOP_K,
    minScore: env.RAG_MIN_SCORE,
    docTypes,
  });
}

export function buildSopTool({ knowledge }: RagToolDeps, role?: string | null) {
  const allowed = allowedDocTypes(role);
  return new DynamicStructuredTool({
    name: "cari_sop",
    description:
      "Mencari SOP, kebijakan, runbook, panduan produk, onboarding, FAQ, catatan partner, atau kontrak internal. Gunakan untuk pertanyaan prosedural/kebijakan yang bukan data transaksional. Isi `docType` bila jenisnya jelas untuk mempersempit pencarian.",
    schema: sopSchema,
    func: async (input: SopInput): Promise<string> => {
      if (input.docType && !allowed.includes(input.docType)) {
        return `Anda tidak memiliki akses ke dokumen jenis "${input.docType}".`;
      }
      const docTypes = input.docType ? [input.docType] : allowed;
      const chunks = await search(knowledge, input.query, docTypes);
      return formatChunks(chunks, "Tidak ada SOP/panduan yang relevan di knowledge base.");
    },
  });
}
