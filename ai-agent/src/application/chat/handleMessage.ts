import { runAgent } from "../agent/agent";
import { appendHistory, getHistory } from "./memory";
import { isRateLimited } from "./rateLimit";
import type { ToolDeps } from "../tools";

const PLATFORM = "TELEGRAM" as const;

export type HandleMessageStatus = "ok" | "unregistered" | "rate_limited" | "error";

export interface HandleMessageInput {
  chatId: string;
  text: string;
  /** Dipanggil setelah lolos validasi user & rate limit (mis. indikator "typing"). */
  onThinking?: () => Promise<void>;
}

export interface HandleMessageResult {
  status: HandleMessageStatus;
  reply: string;
}

/**
 * Workflow satu pesan masuk: validasi user, rate limit, jalankan agent,
 * simpan riwayat, dan catat log percakapan. Tidak menyentuh detail transport.
 */
export async function handleMessage(
  deps: ToolDeps,
  input: HandleMessageInput,
): Promise<HandleMessageResult> {
  const { chatId, text } = input;

  const user = await deps.backend.resolveChatUser(chatId);
  if (!user) {
    await deps.backend.logConversation({
      platform: PLATFORM,
      chatId,
      messageIn: text,
      messageOut: null,
    });
    return {
      status: "unregistered",
      reply: "Maaf, akun Anda belum terdaftar sebagai pengguna aktif. Hubungi admin.",
    };
  }

  if (isRateLimited(chatId)) {
    return { status: "rate_limited", reply: "Terlalu banyak permintaan. Mohon tunggu sebentar ya." };
  }

  await input.onThinking?.();
  const started = Date.now();

  try {
    const result = await runAgent(
      { chatId, message: text, history: getHistory(chatId), role: user.role },
      deps,
    );
    appendHistory(chatId, text, result.output);

    await deps.backend.logConversation({
      platform: PLATFORM,
      chatId,
      messageIn: text,
      messageOut: result.output,
      toolName: result.toolName,
      toolPayload: result.toolPayload,
      toolResult: result.toolResult,
      latencyMs: Date.now() - started,
    });

    return { status: "ok", reply: result.output };
  } catch (err) {
    console.error("Agent error:", err);
    await deps.backend.logConversation({
      platform: PLATFORM,
      chatId,
      messageIn: text,
      messageOut: null,
      latencyMs: Date.now() - started,
    });
    return {
      status: "error",
      reply: "Maaf, sistem sedang mengalami gangguan. Coba lagi nanti.",
    };
  }
}
