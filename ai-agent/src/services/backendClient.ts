import axios from "axios";
import { env } from "../config/env";

/** HTTP client ke Backend API (satu-satunya jalur data bisnis). */
export const backend = axios.create({
  baseURL: env.BACKEND_API_URL,
  timeout: 15_000,
  headers: { "x-internal-key": env.INTERNAL_API_KEY },
});

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

/** Validasi chatId terdaftar sebagai user aktif. */
export async function resolveChatUser(chatId: string): Promise<ChatUser | null> {
  try {
    const { data } = await backend.get(`/internal/chat-user/${encodeURIComponent(chatId)}`);
    return data.data as ChatUser;
  } catch {
    return null;
  }
}

export interface AiLogInput {
  platform: "TELEGRAM" | "WHATSAPP";
  chatId: string;
  messageIn: string;
  messageOut?: string | null;
  intent?: string | null;
  toolName?: string | null;
  toolPayload?: unknown;
  toolResult?: unknown;
  latencyMs?: number;
}

export async function logConversation(input: AiLogInput): Promise<void> {
  try {
    await backend.post("/internal/ai-log", input);
  } catch {
    // logging tidak boleh menggagalkan balasan ke user
  }
}
