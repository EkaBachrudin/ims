import type { Telegraf } from "telegraf";
import type { Messenger, ReplyTarget } from "../../application/ports/messenger";
import { deliverMarkdown } from "./sendMarkdown";

/**
 * Buat messenger Telegram. `getBot` dibaca saat pengiriman agar instance bot
 * yang berjalan bisa di-set belakangan tanpa state global.
 */
export function createMessenger(getBot: () => Telegraf | null): Messenger {
  async function reply(target: ReplyTarget, markdown: string): Promise<void> {
    const bot = getBot();
    if (!bot || !markdown.trim()) return;

    await deliverMarkdown(bot.telegram, target.chatId, markdown, {
      messageThreadId: target.messageThreadId,
    });
  }

  async function sendTyping(chatId: string, messageThreadId?: number): Promise<void> {
    const bot = getBot();
    if (!bot) return;

    try {
      await bot.telegram.sendChatAction(
        chatId,
        "typing",
        messageThreadId ? { message_thread_id: messageThreadId } : {},
      );
    } catch (err) {
      console.error(`Gagal mengirim status typing ke chat ${chatId}:`, err);
    }
  }

  return { reply, sendTyping };
}
