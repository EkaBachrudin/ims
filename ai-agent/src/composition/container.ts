import { backendGateway } from "../infrastructure/backend/backendGateway";
import { knowledgeBase } from "../infrastructure/rag/knowledgeBase";
import type { BackendGateway } from "../application/ports/backendGateway";
import type { KnowledgeBase } from "../application/ports/knowledgeBase";

/** Composition root: adapter default untuk port lintas-cutting. */
export const container: { backend: BackendGateway; knowledge: KnowledgeBase } = {
  backend: backendGateway,
  knowledge: knowledgeBase,
};
