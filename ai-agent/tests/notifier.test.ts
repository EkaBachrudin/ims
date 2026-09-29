import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Telegraf } from "telegraf";
import {
  isBotReady,
  notifyChats,
  notifySchema,
  sendNotification,
  setBot,
} from "../src/bot/notifier";

describe("notifySchema", () => {
  it("menerima payload valid", () => {
    const res = notifySchema.safeParse({
      chatIds: ["123"],
      text: "Halo **Bos**",
      button: { label: "Buka", url: "http://localhost:5173/purchase-orders/x" },
    });
    expect(res.success).toBe(true);
  });

  it("menolak chatIds kosong dan URL tidak valid", () => {
    expect(notifySchema.safeParse({ chatIds: [], text: "hi" }).success).toBe(false);
    expect(
      notifySchema.safeParse({
        chatIds: ["1"],
        text: "hi",
        button: { label: "Buka", url: "bukan-url" },
      }).success,
    ).toBe(false);
  });
});

describe("sendNotification", () => {
  it("mengembalikan false bila bot belum siap", async () => {
    expect(isBotReady()).toBe(false);
    expect(await sendNotification("123", "Halo")).toBe(false);
  });
});

describe("sendNotification dengan bot", () => {
  const sendMessage = vi.fn();

  beforeEach(() => {
    sendMessage.mockReset();
    setBot({ telegram: { sendMessage } } as unknown as Telegraf);
  });

  it("mengirim HTML beserta tombol inline", async () => {
    sendMessage.mockResolvedValue(undefined);
    const sent = await sendNotification("123", "Draft **PO-1**", {
      label: "Buka & Konfirmasi PO",
      url: "http://localhost:5173/purchase-orders/x",
    });

    expect(sent).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith("123", "Draft <b>PO-1</b>", {
      parse_mode: "HTML",
      reply_markup: expect.anything(),
    });
  });

  it("fallback ke teks polos bila Telegram menolak HTML", async () => {
    sendMessage.mockRejectedValueOnce(new Error("can't parse entities")).mockResolvedValueOnce(undefined);
    const sent = await sendNotification("123", "Draft **PO-1**");

    expect(sent).toBe(true);
    expect(sendMessage).toHaveBeenLastCalledWith("123", "Draft **PO-1**", {
      reply_markup: undefined,
    });
  });

  it("mengirim ke semua penerima", async () => {
    sendMessage.mockResolvedValue(undefined);
    const results = await notifyChats({ chatIds: ["1", "2"], text: "Halo" });
    expect(results).toEqual([
      { chatId: "1", sent: true },
      { chatId: "2", sent: true },
    ]);
  });
});
