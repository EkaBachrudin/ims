import { describe, expect, it } from "vitest";
import {
  formatIdDate,
  formatIdDay,
  formatLowStockList,
  formatPoList,
  formatProductList,
  formatTransactionList,
  shownNote,
} from "../src/application/tools/format";
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

describe("format tanggal", () => {
  it("mengubah tanggal ISO menjadi tanggal Indonesia", () => {
    expect(formatIdDate("2026-10-04 08:00")).toBe("4 Okt 2026");
    expect(formatIdDate("2026-09-01")).toBe("1 Sep 2026");
    expect(formatIdDate(null)).toBeNull();
  });

  it("menyediakan header hari tanpa tahun", () => {
    expect(formatIdDay("2026-10-04 08:00")).toBe("4 Okt");
  });
});

describe("shownNote", () => {
  it("menyebut sisa data hanya bila terpotong", () => {
    expect(shownNote(20, 49, "transaksi")).toBe("menampilkan 20 dari 49 transaksi");
    expect(shownNote(49, 49, "transaksi")).toBe("");
    expect(shownNote(5, undefined, "PO")).toBe("");
  });
});

describe("formatTransactionList", () => {
  const meta = { page: 1, limit: 20, total: 49, totalPages: 3 };
  const rows = [
    {
      date: "2026-10-04 08:00",
      type: "OUT",
      product: "Kangkung Kemasan 1kg",
      sku: "K-1",
      quantity: 488,
      unit: "ikat",
      warehouse: "Gudang Utama",
      partner: "Kios Pelita",
      poNumber: null,
    },
    {
      date: "2026-10-04 09:00",
      type: "OUT",
      product: "Sawi Hijau Kemasan 500g",
      sku: "S-5",
      quantity: 291,
      unit: "pack",
      warehouse: "Gudang Utama",
      partner: "UD Sejahtera",
      poNumber: null,
    },
    {
      date: "2026-10-01 08:00",
      type: "OUT",
      product: "Kangkung Kemasan 500g",
      sku: "K-5",
      quantity: 13,
      unit: "kg",
      warehouse: "Gudang Utama",
      partner: "CV Cahaya",
      poNumber: null,
    },
  ];

  it("mengelompokkan per tanggal, membuat kartu, dan meringkas footer", () => {
    const out = formatTransactionList(rows, meta, undefined, undefined);
    expect(out).toContain("**4 Okt**");
    expect(out).toContain("**1 Okt**");
    expect(out).toContain("• **Kangkung Kemasan 1kg**\n  KELUAR · 488 ikat → Kios Pelita");
    expect(out).toContain("gudang Gudang Utama");
    expect(out).toContain("Total: 49 transaksi");
    expect(out).toContain("menampilkan 3 dari 49 transaksi");
    expect(out.indexOf("4 Okt")).toBeLessThan(out.indexOf("1 Okt"));
  });

  it("menampilkan gudang per item bila gudang berbeda", () => {
    const out = formatTransactionList(
      [rows[0], { ...rows[2], warehouse: "Gudang Cabang" }],
      meta,
      undefined,
      undefined,
    );
    expect(out).toContain("(Gudang Utama)");
    expect(out).toContain("(Gudang Cabang)");
    expect(out).not.toContain("gudang Gudang Utama.");
  });
});

describe("formatPoList", () => {
  it("membuat kartu PO dengan target dan item", () => {
    const out = formatPoList(
      [
        {
          poNumber: "PO-202610-001",
          status: "DRAFT",
          partner: "CV Berkah Abadi",
          targetDate: "2026-10-14",
          createdAt: "2026-10-07 05:00",
          items: [{ product: "Kecap Manis Botol 100ml", quantity: 600, unit: "pack" }],
        },
      ],
      { page: 1, limit: 20, total: 1, totalPages: 1 },
      undefined,
      undefined,
    );
    expect(out).toContain("**PO-202610-001** · DRAFT — CV Berkah Abadi");
    expect(out).toContain("– 600 pack Kecap Manis Botol 100ml");
    expect(out).toContain("target 14 Okt 2026");
    expect(out).toContain("Total: 1 PO");
  });
});

describe("formatProductList", () => {
  it("membuat kartu produk dengan stok, SKU, kategori, dan penanda stok tipis", () => {
    const out = formatProductList(
      [
        {
          sku: "MYK-011",
          name: "Tepung Beras Kemasan 1kg",
          unit: "sak",
          stock: 404,
          category: "Makanan Kering",
          lowStock: false,
        },
        {
          sku: "MYK-010",
          name: "Tepung Beras Kemasan 500g",
          unit: "pack",
          stock: 9,
          category: "Makanan Kering",
          lowStock: true,
        },
      ],
      { page: 1, limit: 20, total: 3, totalPages: 1 },
    );
    expect(out).toContain(
      "• **Tepung Beras Kemasan 1kg**\n  stok 404 sak · SKU MYK-011 · Makanan Kering",
    );
    expect(out).toContain("stok 9 pack · SKU MYK-010 · Makanan Kering · stok tipis");
    expect(out).toContain("Total: 3 produk");
    expect(out).toContain("menampilkan 2 dari 3 produk");
  });

  it("mengembalikan kalimat tunggal bila katalog kosong", () => {
    expect(formatProductList([], undefined)).toBe("Tidak ada produk yang cocok.");
  });
});

describe("formatLowStockList", () => {
  it("menambah kekurangan dan mengurutkan paling kritis dulu", () => {
    const out = formatLowStockList([
      { name: "Kangkung Kemasan 1kg", sku: "SYR-015", stock: 6, minStock: 10, unit: "ikat" },
      { name: "Saus Sambal Kemasan 500g", sku: "BMB-006", stock: 3, minStock: 14, unit: "pack" },
      { name: "Mi Instan Kuah Rasa Original", sku: "INS-004", stock: 7, minStock: 28, unit: "box" },
    ]);
    expect(out).toContain("**Stok tipis (3 produk):**");
    expect(out).toContain("stok 3 pack · min 14 · kurang 11 · SKU BMB-006");
    // rasio 3/14 (0.21) < 7/28 (0.25) < 6/10 (0.6)
    expect(out.indexOf("Saus Sambal")).toBeLessThan(out.indexOf("Mi Instan"));
    expect(out.indexOf("Mi Instan")).toBeLessThan(out.indexOf("Kangkung"));
  });

  it("mengembalikan kalimat tunggal bila tidak ada stok tipis", () => {
    expect(formatLowStockList([])).toBe("Tidak ada produk dengan stok tipis.");
  });
});
