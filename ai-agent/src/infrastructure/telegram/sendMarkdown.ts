import type { Telegraf } from "telegraf";
import { markdownToTelegramHtml, stripHtml } from "../../lib/telegramFormat";

type Telegram = Telegraf["telegram"];
type SendOptions = NonNullable<Parameters<Telegram["sendMessage"]>[2]>;

export interface DeliverOptions {
  messageThreadId?: number;
  reply_markup?: SendOptions["reply_markup"];
}

/**
 * Kirim markdown sebagai HTML Telegram, dengan fallback teks polos bila
 * Telegram menolak parse. `true` bila berhasil terkirim.
 */
export async function deliverMarkdown(
  telegram: Telegram,
  chatId: string | number,
  markdown: string,
  opts: DeliverOptions = {},
): Promise<boolean> {
  const html = markdownToTelegramHtml(markdown);

  const extra: SendOptions = {};
  if (opts.messageThreadId) extra.message_thread_id = opts.messageThreadId;
  if (opts.reply_markup) extra.reply_markup = opts.reply_markup;

  try {
    await telegram.sendMessage(chatId, html, { parse_mode: "HTML", ...extra });
    return true;
  } catch {
    try {
      await telegram.sendMessage(chatId, stripHtml(html), extra);
      return true;
    } catch (err) {
      console.error(`Gagal mengirim pesan ke chat ${chatId}:`, err);
      return false;
    }
  }
}
