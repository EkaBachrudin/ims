import http from "node:http";
import { env } from "./config/env";
import { createBot } from "./bot/telegram";

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true, data: { status: "ok", service: "ai-agent" } }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));
});

server.listen(env.PORT, () => {
  console.log(`AI agent health server di http://localhost:${env.PORT}`);
});

async function main() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN belum diisi; bot tidak dijalankan (health server tetap aktif).");
    return;
  }
  try {
    const bot = createBot();
    await bot.launch();
    console.log("Asisten WMS bot running (long-polling)...");

    const stop = (signal: string) => {
      console.log(`\n${signal} diterima, menghentikan bot...`);
      bot.stop(signal);
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
