import { Telegraf, type Context } from "telegraf";
import { message } from "telegraf/filters";
import { requireTelegramToken } from "../../config/env";
import { container } from "../../composition/container";
import { handleMessage } from "../../application/chat/handleMessage";
import { clearHistory } from "../../application/chat/memory";
import type { Messenger } from "../../application/ports/messenger";

export interface BotDeps {
  messenger: Messenger;
}

export function createBot({ messenger }: BotDeps): Telegraf {
  const bot = new Telegraf(requireTelegramToken());

  bot.start((ctx) => {
    const chatId = String(ctx.chat.id);
    clearHistory(chatId);
    return messenger.reply(
      { chatId },
      "Halo Bos! 👋 Saya Asisten Gudang.\n\nCoba tanyakan:\n" +
        '• "Berapa sisa stok dimsum ukuran sedang?"\n' +
        '• "Produk air mineral ada ukuran apa saja?"\n' +
        '• "Barang masuk dari tanggal 10 sampai hari ini?"\n' +
        '• "Tampilkan PO yang sudah confirmed"\n' +
        '• "Kemarin kita kirim ke mana saja?"\n' +
        '• "Besok siapkan PO untuk CV Sumber Frozen isinya 50 pack Dimsum"\n' +
        '• "Buat surat jalan untuk Agen Bahari isi 10 pack Dimsum"\n' +
        '• "Apa SOP penerimaan barang retur?"',
    );
  });

  bot.on(message("text"), async (ctx: Context) => {
    const { text, message_thread_id } = ctx.message as {
      text: string;
      message_thread_id?: number;
    };
    const chatId = String(ctx.chat!.id);

    const result = await handleMessage(container, {
      chatId,
      text,
      onThinking: () => messenger.sendTyping(chatId, message_thread_id),
    });

    await messenger.reply({ chatId, messageThreadId: message_thread_id }, result.reply);
  });

  bot.catch((err) => console.error("Telegram error:", err));

  return bot;
}
