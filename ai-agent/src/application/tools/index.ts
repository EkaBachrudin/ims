import type { BackendGateway } from "../ports/backendGateway";
import type { KnowledgeBase } from "../ports/knowledgeBase";
import { buildReadTools } from "./read";
import { buildSopTool } from "./rag";
import { buildWriteTools } from "./write";

export interface ToolDeps {
  backend: BackendGateway;
  knowledge: KnowledgeBase;
}

/**
 * Bangun seluruh tool agent. `deps` adalah port (bukan adapter konkret) agar
 * mudah diuji; `chatId` di-inject untuk endpoint internal pembuatan draft.
 */
export function buildTools(deps: ToolDeps, chatId: string) {
  return [...buildReadTools(deps), ...buildWriteTools(deps, chatId), buildSopTool(deps)];
}

export type AgentTools = ReturnType<typeof buildTools>;
