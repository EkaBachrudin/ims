import { Telegraf, type Context } from "telegraf";
import { message } from "telegraf/filters";
import { requireTelegramToken } from "../config/env";
import { runAgent } from "../agent/agent";
import { logConversation, resolveChatUser } from "../services/backendClient";
import { appendHistory, clearHistory, getHistory } from "./memory";
import { isRateLimited } from "./rateLimit";

const PLATFORM = "TELEGRAM" as const;

export function createBot(): Telegraf {
  const bot = new Telegraf(requireTelegramToken());

  bot.start((ctx) => {
    clearHistory(String(ctx.chat.id));
    return ctx.reply(
      "Halo Bos! 👋 Saya Asisten Gudang.\n\nCoba tanyakan:\n" +
        "• \"Berapa sisa stok dimsum ukuran sedang?\"\n" +
        "• \"Kemarin kita kirim ke mana saja?\"\n" +
        "• \"Besok siapkan PO untuk PT Maju Jaya isinya 50 pack Dimsum\"\n" +
        "• \"Apa SOP penerimaan barang retur?\"",
    );
  });

  bot.on(message("text"), async (ctx: Context) => {
    const text = (ctx.message as { text: string }).text;
    const chatId = String(ctx.chat!.id);

    const user = await resolveChatUser(chatId);
    if (!user) {
      await ctx.reply("Maaf, akun Anda belum terdaftar sebagai pengguna aktif. Hubungi admin.");
      await logConversation({ platform: PLATFORM, chatId, messageIn: text, messageOut: null });
      return;
    }

    if (isRateLimited(chatId)) {
      await ctx.reply("Terlalu banyak permintaan. Mohon tunggu sebentar ya.");
      return;
    }

    await ctx.sendChatAction("typing");
    const started = Date.now();

    try {
      const result = await runAgent({
        chatId,
        message: text,
        history: getHistory(chatId),
      });
      await ctx.reply(result.output);
      appendHistory(chatId, text, result.output);

      await logConversation({
        platform: PLATFORM,
        chatId,
        messageIn: text,
        messageOut: result.output,
        toolName: result.toolName,
        toolPayload: result.toolPayload,
        toolResult: result.toolResult,
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      console.error("Agent error:", err);
      await ctx.reply("Maaf, sistem sedang mengalami gangguan. Coba lagi nanti.");
      await logConversation({
        platform: PLATFORM,
        chatId,
        messageIn: text,
        messageOut: null,
        latencyMs: Date.now() - started,
      });
    }
  });

  bot.catch((err) => console.error("Telegram error:", err));

  return bot;
}
