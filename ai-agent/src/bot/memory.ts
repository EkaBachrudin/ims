import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { env } from "../config/env";

const store = new Map<string, BaseMessage[]>();

export function getHistory(chatId: string): BaseMessage[] {
  return store.get(chatId) ?? [];
}

/** Simpan giliran percakapan, dibatasi MAX_HISTORY_TURNS giliran (1 giliran = 2 pesan). */
export function appendHistory(chatId: string, userText: string, aiText: string): void {
  const history = store.get(chatId) ?? [];
  history.push(new HumanMessage(userText), new AIMessage(aiText));
  const maxMessages = env.MAX_HISTORY_TURNS * 2;
  while (history.length > maxMessages) history.shift();
  store.set(chatId, history);
}

export function clearHistory(chatId: string): void {
  store.delete(chatId);
}
