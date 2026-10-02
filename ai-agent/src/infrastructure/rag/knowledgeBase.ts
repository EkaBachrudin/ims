import type { KnowledgeBase } from "../../application/ports/knowledgeBase";
import { searchKnowledge } from "./retriever";

export const knowledgeBase: KnowledgeBase = {
  search: (query, topK) => searchKnowledge(query, topK),
};
