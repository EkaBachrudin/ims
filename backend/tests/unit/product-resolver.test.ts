import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { normalizeName, resolveProduct, searchProducts, tokenize } from "../../src/modules/products/product-resolver";

const CATALOG = [
  { id: "1", name: "Cumi-Cumi Beku 1kg", sku: "SEA-012" },
  { id: "2", name: "Cumi-Cumi Beku 500g", sku: "SEA-011" },
  { id: "3", name: "Cumi-Cumi Segar 500g", sku: "SEA-010" },
  { id: "4", name: "Bubur Instan Rasa Pedas", sku: "INS-015" },
  { id: "5", name: "Bubur Instan Rasa Ayam Bawang", sku: "INS-014" },
];

function fakeDb() {
  return {
    product: { findMany: async () => CATALOG },
  } as unknown as PrismaClient;
}

describe("normalizeName", () => {
  it("menyeragamkan spasi angka-satuan dan sinonim satuan", () => {
    expect(normalizeName("1 kilo")).toBe("1kg");
    expect(normalizeName("500 g")).toBe("500g");
    expect(normalizeName("2 liter")).toBe("2l");
  });

  it("mengubah singkatan pengulangan (cumi2 -> cumicumi)", () => {
    expect(normalizeName("cumi2 beku 1 kilo")).toBe("cumicumi beku 1kg");
  });

  it("mengubah strip/tanda baca menjadi pemisah", () => {
    expect(normalizeName("Cumi-Cumi Beku 1kg")).toBe("cumi cumi beku 1kg");
  });

  it("menyamakan penulisan 'mie' dengan 'mi'", () => {
    expect(normalizeName("mie instan")).toBe("mi instan");
    expect(normalizeName("Miee Goreng")).toBe("mi goreng");
  });
});

describe("tokenize", () => {
  it("memecah nama ternormalisasi menjadi token", () => {
    expect(tokenize("Cumi-Cumi Beku 1kg")).toEqual(["cumi", "cumi", "beku", "1kg"]);
  });
});

describe("resolveProduct", () => {
  it("mencocokkan penulisan bebas user ke nama katalog", async () => {
    const result = await resolveProduct("cumi2 beku 1 kilo", fakeDb());
    expect(result).toEqual({ status: "ok", product: CATALOG[0] });
  });

  it("mencocokkan nama yang menghilangkan kata varian (rasa)", async () => {
    const result = await resolveProduct("bubur instan pedas", fakeDb());
    expect(result).toEqual({ status: "ok", product: CATALOG[3] });
  });

  it("mengembalikan ambiguous bila beberapa produk cocok", async () => {
    const result = await resolveProduct("cumi beku", fakeDb());
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.sku).sort()).toEqual(["SEA-011", "SEA-012"]);
    }
  });

  it("mengembalikan none dengan saran bila produk tidak ada", async () => {
    const result = await resolveProduct("cumi bakar madu", fakeDb());
    expect(result.status).toBe("none");
    if (result.status === "none") {
      expect(result.suggestions.map((c) => c.sku)).toContain("SEA-012");
    }
  });
});

describe("searchProducts", () => {
  const catalog = [
    { id: "1", name: "Mi Instan Goreng Rasa Original", sku: "INS-001" },
    { id: "2", name: "Bihun Instan Rasa Original", sku: "INS-007" },
    { id: "3", name: "Dimsum Ayam Ukuran Sedang", sku: "DMS-001" },
  ];

  function db() {
    return { product: { findMany: async () => catalog } } as unknown as PrismaClient;
  }

  it("cocok pada variasi penulisan (mie instan -> Mi Instan)", async () => {
    const result = await searchProducts("mie instan", db());
    expect(result.map((p) => p.sku)).toEqual(["INS-001"]);
  });

  it("tetap mendukung pencarian substring dan SKU", async () => {
    expect((await searchProducts("bihun", db())).map((p) => p.sku)).toEqual(["INS-007"]);
    expect((await searchProducts("DMS-001", db())).map((p) => p.id)).toEqual(["3"]);
  });

  it("mengembalikan semua produk bila query kosong", async () => {
    expect(await searchProducts("  ", db())).toHaveLength(3);
  });
});
