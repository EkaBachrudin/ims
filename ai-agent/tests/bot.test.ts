import { describe, expect, it, beforeEach } from "vitest";
import { isRateLimited, resetRateLimit } from "../src/bot/rateLimit";
import { appendHistory, clearHistory, getHistory } from "../src/bot/memory";
import { buildAgentPrompt } from "../src/agent/prompt";

describe("rate limit", () => {
  beforeEach(() => resetRateLimit());

  it("mengizinkan pesan dalam batas", () => {
    for (let i = 0; i < 12; i++) {
      expect(isRateLimited("chat-1")).toBe(false);
    }
  });

  it("memblokir setelah melewati batas", () => {
    for (let i = 0; i < 12; i++) isRateLimited("chat-2");
    expect(isRateLimited("chat-2")).toBe(true);
  });

  it("membatasi per chat secara independen", () => {
    for (let i = 0; i < 12; i++) isRateLimited("chat-a");
    expect(isRateLimited("chat-b")).toBe(false);
  });
});

describe("conversation memory", () => {
  it("menyimpan dan membatasi riwayat percakapan", () => {
    clearHistory("chat-mem");
    for (let i = 0; i < 30; i++) appendHistory("chat-mem", `tanya ${i}`, `jawab ${i}`);
    // MAX_HISTORY_TURNS default 20 -> 40 pesan
    expect(getHistory("chat-mem").length).toBeLessThanOrEqual(40);
  });
});

describe("system prompt", () => {
  it("memuat guardrail anti-halusinasi dan tool SOP", async () => {
    const prompt = buildAgentPrompt("2026-09-22");
    const messages = await prompt.formatMessages({
      input: "halo",
      chat_history: [],
      agent_scratchpad: [],
    });
    const system = JSON.stringify(messages[0]);
    expect(system).toContain("JANGAN PERNAH mengarang");
    expect(system).toContain("cari_sop");
    expect(system).toContain("2026-09-22");
  });

  it("memuat aturan gaya & format jawaban", async () => {
    const prompt = buildAgentPrompt("2026-09-22");
    const messages = await prompt.formatMessages({
      input: "halo",
      chat_history: [],
      agent_scratchpad: [],
    });
    const system = JSON.stringify(messages[0]);
    expect(system).toContain("Gaya & format jawaban");
    expect(system).toContain("Template balasan Draft PO");
    expect(system).toContain("•");
  });
});
