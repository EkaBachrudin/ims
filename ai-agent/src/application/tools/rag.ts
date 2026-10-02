import { DynamicStructuredTool } from "@langchain/core/tools";
import { env } from "../../config/env";
import type { KnowledgeBase } from "../ports/knowledgeBase";
import { type SopInput, sopSchema } from "./schemas";

export interface RagToolDeps {
  knowledge: KnowledgeBase;
}

export function buildSopTool({ knowledge }: RagToolDeps) {
  return new DynamicStructuredTool({
    name: "cari_sop",
    description:
      "Mencari SOP, kebijakan, panduan internal, atau penjelasan istilah/skema data. Gunakan untuk pertanyaan prosedural yang bukan data transaksional.",
    schema: sopSchema,
    func: async (input: SopInput): Promise<string> => {
      const chunks = await knowledge.search(input.query, env.AGENT_TOP_K);
      if (chunks.length === 0) return "Tidak ada SOP/panduan yang relevan di knowledge base.";
      return chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.content}`).join("\n\n");
    },
  });
}
