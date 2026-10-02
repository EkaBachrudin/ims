import { Markup, type Telegraf } from "telegraf";
import type { Notifier, NotifyRequest, NotifyResult } from "../../application/ports/notifier";
import { deliverMarkdown } from "./sendMarkdown";

/**
 * Buat notifier Telegram. `getBot` dibaca saat pengiriman agar instance bot
 * yang berjalan bisa di-set belakangan tanpa state global.
 */
export function createNotifier(getBot: () => Telegraf | null): Notifier {
  async function sendNotification(
    chatId: string,
    markdown: string,
    button?: NotifyRequest["button"],
  ): Promise<boolean> {
    const bot = getBot();
    if (!bot) return false;

    const reply_markup = button
      ? Markup.inlineKeyboard([Markup.button.url(button.label, button.url)]).reply_markup
      : undefined;

    return deliverMarkdown(bot.telegram, chatId, markdown, { reply_markup });
  }

  async function notifyChats(payload: NotifyRequest): Promise<NotifyResult[]> {
    const results: NotifyResult[] = [];
    for (const chatId of payload.chatIds) {
      results.push({ chatId, sent: await sendNotification(chatId, payload.text, payload.button) });
    }
    return results;
  }

  return { isReady: () => getBot() !== null, sendNotification, notifyChats };
}
