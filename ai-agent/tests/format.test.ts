import { describe, expect, it } from "vitest";
import { markdownToTelegramHtml } from "../src/lib/telegramFormat";

describe("markdownToTelegramHtml", () => {
  it("mengubah tebal, miring, dan kode inline menjadi tag Telegram", () => {
    const html = markdownToTelegramHtml("Draft **PO-1** untuk *PT Sinar* kode `AI_CHAT`.");
    expect(html).toBe("Draft <b>PO-1</b> untuk <i>PT Sinar</i> kode <code>AI_CHAT</code>.");
  });

  it("menormalkan bullet dan menghapus heading", () => {
    const html = markdownToTelegramHtml("# Daftar\n- Satu\n* Dua");
    expect(html).toBe("Daftar\n• Satu\n• Dua");
  });

  it("mengubah baris tabel menjadi daftar tanpa pipe", () => {
    const html = markdownToTelegramHtml("| Nama | Stok |\n| --- | --- |\n| Dimsum | 10 |");
    expect(html).not.toContain("|");
    expect(html).toContain("Dimsum");
    expect(html).toContain("10");
  });

  it("meng-escape karakter HTML dari data", () => {
    const html = markdownToTelegramHtml("Stok < 10 & aman");
    expect(html).toContain("&lt; 10 &amp; aman");
  });

  it("mempertahankan blok kode", () => {
    const html = markdownToTelegramHtml("```\nSELECT * FROM po\n```");
    expect(html).toBe("<pre>SELECT * FROM po</pre>");
  });
});
