export interface ReplyTarget {
  chatId: string;
  /** Topik forum tujuan (dipertahankan dari perilaku ctx.reply). */
  messageThreadId?: number;
}

/** Kontrak balasan interaktif ke channel (adapter outbound). */
export interface Messenger {
  reply(target: ReplyTarget, markdown: string): Promise<void>;
  sendTyping(chatId: string, messageThreadId?: number): Promise<void>;
}
