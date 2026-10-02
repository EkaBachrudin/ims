import { env } from "./config/env";
import { createBot } from "./presentation/telegram/bot";
import { createNotifier } from "./infrastructure/telegram/notifier";
import { createMessenger } from "./infrastructure/telegram/messenger";
import { createHttpServer } from "./presentation/http/server";

let bot: ReturnType<typeof createBot> | null = null;
const notifier = createNotifier(() => bot);
const messenger = createMessenger(() => bot);
const server = createHttpServer(notifier);

server.listen(env.PORT, () => {
  console.log(`AI agent health server di http://localhost:${env.PORT}`);
});

async function main() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN belum diisi; bot tidak dijalankan (health server tetap aktif).");
    return;
  }
  try {
    bot = createBot({ messenger });
    await bot.launch();
    console.log("Asisten WMS bot running (long-polling)...");

    const stop = (signal: string) => {
      console.log(`\n${signal} diterima, menghentikan bot...`);
      bot?.stop(signal);
      server.close();
      process.exit(0);
    };
    process.once("SIGINT", () => stop("SIGINT"));
    process.once("SIGTERM", () => stop("SIGTERM"));
  } catch (err) {
    // Jangan hentikan proses: health server tetap hidup agar kontainer tidak crash-loop.
    console.error("Bot gagal dijalankan (cek TELEGRAM_BOT_TOKEN):", err);
  }
}

main().catch((err) => {
  console.error("Gagal menjalankan ai-agent:", err);
  process.exit(1);
});
