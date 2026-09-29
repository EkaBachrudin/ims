import { Markup, type Telegraf } from "telegraf";
import { z } from "zod";
import { markdownToTelegramHtml } from "./format";

export const notifySchema = z.object({
  chatIds: z.array(z.string().trim().min(1)).min(1),
  text: z.string().trim().min(1),
  button: z
    .object({
      label: z.string().trim().min(1),
      url: z.string().url(),
    })
    .optional(),
});

export type NotifyRequest = z.infer<typeof notifySchema>;

let bot: Telegraf | null = null;

/** Simpan instance bot yang sedang berjalan agar bisa dipakai push message. */
export function setBot(instance: Telegraf): void {
  bot = instance;
}

export function isBotReady(): boolean {
  return bot !== null;
}

/**
 * Kirim satu notifikasi proaktif. Mengembalikan `false` bila bot belum siap
 * atau pengiriman gagal (mis. user belum pernah /start bot).
 */
export async function sendNotification(
  chatId: string,
  markdown: string,
  button?: NotifyRequest["button"],
): Promise<boolean> {
  if (!bot) return false;

  const reply_markup = button
    ? Markup.inlineKeyboard([Markup.button.url(button.label, button.url)]).reply_markup
    : undefined;

  try {
    await bot.telegram.sendMessage(chatId, markdownToTelegramHtml(markdown), {
      parse_mode: "HTML",
      reply_markup,
    });
    return true;
  } catch {
    try {
      await bot.telegram.sendMessage(chatId, markdown, { reply_markup });
      return true;
    } catch (err) {
      console.error(`Gagal mengirim notifikasi ke chat ${chatId}:`, err);
      return false;
    }
  }
}

export async function notifyChats(
  payload: NotifyRequest,
): Promise<{ chatId: string; sent: boolean }[]> {
  const results: { chatId: string; sent: boolean }[] = [];
  for (const chatId of payload.chatIds) {
    results.push({ chatId, sent: await sendNotification(chatId, payload.text, payload.button) });
  }
  return results;
}
