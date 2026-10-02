import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Telegraf } from "telegraf";
import { createMessenger } from "../src/infrastructure/telegram/messenger";

describe("createMessenger tanpa bot", () => {
  it("tidak mengirim balasan maupun typing", async () => {
    const messenger = createMessenger(() => null);
    await expect(messenger.reply({ chatId: "123" }, "Halo")).resolves.toBeUndefined();
    await expect(messenger.sendTyping("123")).resolves.toBeUndefined();
  });
});

describe("createMessenger dengan bot", () => {
  const sendMessage = vi.fn();
  const sendChatAction = vi.fn();
  let messenger: ReturnType<typeof createMessenger>;

  beforeEach(() => {
    sendMessage.mockReset();
    sendChatAction.mockReset();
    messenger = createMessenger(
      () => ({ telegram: { sendMessage, sendChatAction } }) as unknown as Telegraf,
    );
  });

  it("mengirim HTML dengan message_thread_id", async () => {
    sendMessage.mockResolvedValue(undefined);
    await messenger.reply({ chatId: "123", messageThreadId: 7 }, "Halo **Bos**");

    expect(sendMessage).toHaveBeenCalledWith("123", "Halo <b>Bos</b>", {
      parse_mode: "HTML",
      message_thread_id: 7,
    });
  });

  it("fallback ke teks polos bila Telegram menolak HTML", async () => {
    sendMessage
      .mockRejectedValueOnce(new Error("can't parse entities"))
      .mockResolvedValueOnce(undefined);

    await messenger.reply({ chatId: "123", messageThreadId: 7 }, "Halo **Bos**");

    expect(sendMessage).toHaveBeenLastCalledWith("123", "Halo Bos", {
      message_thread_id: 7,
    });
  });

  it("tidak mengirim pesan kosong", async () => {
    await messenger.reply({ chatId: "123" }, "   ");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("mengirim status typing beserta message_thread_id", async () => {
    sendChatAction.mockResolvedValue(undefined);
    await messenger.sendTyping("123", 7);
    expect(sendChatAction).toHaveBeenCalledWith("123", "typing", { message_thread_id: 7 });
  });

  it("mengirim status typing tanpa message_thread_id", async () => {
    sendChatAction.mockResolvedValue(undefined);
    await messenger.sendTyping("123");
    expect(sendChatAction).toHaveBeenCalledWith("123", "typing", {});
  });
});
