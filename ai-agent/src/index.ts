import http from "node:http";
import { env } from "./config/env";
import { createBot } from "./bot/telegram";
import { notifyChats, notifySchema, setBot } from "./bot/notifier";

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health" || req.url === "/") {
    json(res, 200, { success: true, data: { status: "ok", service: "ai-agent" } });
    return;
  }

  // Endpoint internal: backend memicu notifikasi Telegram (PO baru/terkonfirmasi/selesai).
  if (req.method === "POST" && req.url === "/notify") {
    if (req.headers["x-internal-key"] !== env.INTERNAL_API_KEY) {
      json(res, 403, { success: false, error: { code: "FORBIDDEN", message: "Invalid internal key" } });
      return;
    }
    try {
      const raw = await readBody(req);
      const parsed = notifySchema.safeParse(JSON.parse(raw || "{}"));
      if (!parsed.success) {
        json(res, 400, {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid notify payload" },
        });
        return;
      }
      const results = await notifyChats(parsed.data);
      json(res, 200, { success: true, data: { results } });
    } catch (err) {
      console.error("Notify error:", err);
      json(res, 500, {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to send notification" },
      });
    }
    return;
  }

  json(res, 404, { success: false, error: { code: "NOT_FOUND", message: "Not found" } });
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
    setBot(bot);
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
