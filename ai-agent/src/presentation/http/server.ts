import http from "node:http";
import { env } from "../../config/env";
import type { Notifier } from "../../application/ports/notifier";
import { notifySchema } from "./notify.schema";

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Server HTTP: health check + endpoint internal notifikasi Telegram. */
export function createHttpServer(notifier: Notifier): http.Server {
  return http.createServer(async (req, res) => {
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
        const results = await notifier.notifyChats(parsed.data);
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
}
