import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyUsers, poUrl } from "../../src/infrastructure/notifier/telegram";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("poUrl", () => {
  it("membangun deep-link detail PO dari WEB_APP_URL", () => {
    expect(poUrl("abc-123")).toBe("http://localhost:5173/purchase-orders/abc-123");
  });
});

describe("notifyUsers", () => {
  it("tidak memanggil fetch bila AI_AGENT_URL belum diset", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await notifyUsers([{ telegramId: "123" }], { text: "halo" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("tidak memanggil fetch bila penerima tidak punya telegramId", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await notifyUsers([{ telegramId: null }], { text: "halo" });
    expect(spy).not.toHaveBeenCalled();
  });
});
