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

/** Port notifikasi keluar. Adapter default mengirim via ai-agent (Telegram). */
export interface NotifierPort {
  notifyUsers(recipients: NotifyRecipient[], payload: NotifyPayload): Promise<void>;
  poUrl(poId: string): string;
}
