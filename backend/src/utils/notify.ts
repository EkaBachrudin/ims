import { env } from "../config/env";

export interface NotifyButton {
  label: string;
  url: string;
}

export interface NotifyPayload {
  text: string;
  button?: NotifyButton;
}

export interface NotifyRecipient {
  telegramId: string | null;
}

function base(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Deep-link halaman detail PO di web dashboard. */
export function poUrl(poId: string): string {
  return `${base(env.WEB_APP_URL)}/purchase-orders/${poId}`;
}

/**
 * Kirim notifikasi Telegram melalui ai-agent. Best-effort: kegagalan hanya
 * di-log dan tidak pernah menggagalkan transaksi bisnis.
 */
export async function notifyUsers(
  recipients: NotifyRecipient[],
  payload: NotifyPayload,
): Promise<void> {
  if (!env.AI_AGENT_URL) return;

  const chatIds = [...new Set(recipients.map((r) => r.telegramId).filter((id): id is string => Boolean(id)))];
  if (chatIds.length === 0) return;

  try {
    const res = await fetch(`${base(env.AI_AGENT_URL)}/notify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify({ chatIds, text: payload.text, button: payload.button }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`Notifikasi Telegram gagal (status ${res.status}) untuk ${chatIds.length} penerima`);
    }
  } catch (err) {
    console.error("Notifikasi Telegram gagal dikirim ke ai-agent:", err);
  }
}
