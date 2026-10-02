import type { Context } from "telegraf";
import { markdownToTelegramHtml, stripHtml } from "../../lib/telegramFormat";

/**
 * Kirim balasan dengan format Telegram HTML. Bila Telegram menolak parse
 * (mis. entitas tidak valid), pesan dikirim ulang sebagai teks polos agar
 * balasan tidak pernah hilang.
 */
export async function sendFormatted(ctx: Context, markdown: string): Promise<void> {
  if (!markdown.trim()) return;

  const html = markdownToTelegramHtml(markdown);
  try {
    await ctx.reply(html, { parse_mode: "HTML" });
  } catch {
    await ctx.reply(stripHtml(html));
  }
}
