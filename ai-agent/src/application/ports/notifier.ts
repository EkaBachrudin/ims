export interface NotifyButton {
  label: string;
  url: string;
}

export interface NotifyRequest {
  chatIds: string[];
  text: string;
  button?: NotifyButton;
}

export interface NotifyResult {
  chatId: string;
  sent: boolean;
}

/** Kontrak pengiriman notifikasi proaktif ke channel (adapter outbound). */
export interface Notifier {
  isReady(): boolean;
  sendNotification(
    chatId: string,
    markdown: string,
    button?: NotifyButton,
  ): Promise<boolean>;
  notifyChats(payload: NotifyRequest): Promise<NotifyResult[]>;
}
