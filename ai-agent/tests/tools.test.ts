import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/backendClient", () => ({
  backend: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("../src/rag/retriever", () => ({ searchKnowledge: vi.fn() }));

import { backend } from "../src/services/backendClient";
import { searchKnowledge } from "../src/rag/retriever";
import { buildTools } from "../src/agent/tools";

const mockedGet = vi.mocked(backend.get);
const mockedPost = vi.mocked(backend.post);
const mockedSearch = vi.mocked(searchKnowledge);

function findTool(name: string) {
  const tool = buildTools("900001").find((t) => t.name === name);
  if (!tool) throw new Error(`tool ${name} tidak ditemukan`);
  return tool;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildTools", () => {
  it("mendaftarkan seluruh tool baca data (FSD §10.2)", () => {
    const names = buildTools("900001")
      .map((t) => t.name)
      .sort();
    expect(names).toEqual([
      "buat_draft_po",
      "buat_draft_surat_jalan",
      "cari_produk",
      "cari_sop",
      "cek_stok_barang",
      "detail_po",
      "list_gudang",
      "list_kategori",
      "list_partner",
      "list_po",
      "list_surat_jalan",
      "list_transaksi",
      "rekap_pengiriman",
      "ringkasan_dashboard",
      "stok_per_gudang",
      "stok_tipis",
    ]);
  });
});

describe("cek_stok_barang", () => {
  it("mengembalikan info stok dari backend", async () => {
    mockedGet.mockResolvedValue({
      data: { data: { name: "Dimsum Ayam", sku: "DMS-01", stock: 120, unit: "pack" } },
    } as never);
    const result = await findTool("cek_stok_barang").invoke({ productName: "dimsum" });
    expect(String(result)).toContain("120");
    expect(String(result)).toContain("DMS-01");
    expect(mockedGet).toHaveBeenCalledWith("/reports/stock/dimsum");
  });

  it("minta klarifikasi bila produk tidak ditemukan (anti-halusinasi)", async () => {
    mockedGet.mockResolvedValue({ data: { data: null } } as never);
    const result = await findTool("cek_stok_barang").invoke({ productName: "tidak ada" });
    expect(String(result).toLowerCase()).toContain("tidak menemukan");
  });
});

describe("buat_draft_po", () => {
  it("mengirim chatId dan source AI_CHAT ke backend", async () => {
    mockedPost.mockResolvedValue({
      data: { data: { poNumber: "PO-202609-001", partner: { name: "CV Sumber Frozen" } } },
    } as never);
    const result = await findTool("buat_draft_po").invoke({
      partnerName: "CV Sumber Frozen",
      items: [{ productName: "Dimsum", qty: 50 }],
    });
    expect(String(result)).toContain("PO-202609-001");
    expect(mockedPost).toHaveBeenCalledWith(
      "/po/draft",
      expect.objectContaining({ source: "AI_CHAT", chatId: "900001" }),
    );
  });

  it("menangani kegagalan backend dengan pesan ramah", async () => {
    mockedPost.mockRejectedValue({
      response: { data: { error: { message: "Partner tidak ditemukan" } } },
    });
    const result = await findTool("buat_draft_po").invoke({
      partnerName: "PT X",
      items: [{ productName: "Dimsum", qty: 1 }],
    });
    expect(String(result)).toContain("Gagal membuat PO");
    expect(String(result)).toContain("Partner tidak ditemukan");
  });
});

describe("buat_draft_surat_jalan", () => {
  it("mengirim chatId ke backend dan mengembalikan nomor DN", async () => {
    mockedPost.mockResolvedValue({
      data: { data: { dnNumber: "DN-202609-001", partner: { name: "Agen Bahari" } } },
    } as never);
    const result = await findTool("buat_draft_surat_jalan").invoke({
      partnerName: "Agen Bahari",
      items: [{ productName: "Dimsum", qty: 10 }],
    });
    expect(String(result)).toContain("DN-202609-001");
    expect(String(result)).toContain("DRAFT");
    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-notes/draft",
      expect.objectContaining({ chatId: "900001" }),
    );
  });

  it("menangani kegagalan backend dengan pesan ramah", async () => {
    mockedPost.mockRejectedValue({
      response: { data: { error: { message: "Partner bukan customer" } } },
    });
    const result = await findTool("buat_draft_surat_jalan").invoke({
      partnerName: "CV X",
      items: [{ productName: "Dimsum", qty: 1 }],
    });
    expect(String(result)).toContain("Gagal membuat Surat Jalan");
    expect(String(result)).toContain("Partner bukan customer");
  });

  it("meneruskan pesan ambigu beserta kandidat produk dari backend", async () => {
    mockedPost.mockRejectedValue({
      response: {
        data: {
          error: {
            message:
              'Produk "cumi beku" cocok dengan beberapa produk: "Cumi-Cumi Beku 1kg", "Cumi-Cumi Beku 500g".',
          },
        },
      },
    });
    const result = await findTool("buat_draft_surat_jalan").invoke({
      partnerName: "Agen Bahari",
      items: [{ productName: "cumi beku", qty: 1 }],
    });
    expect(String(result)).toContain("beberapa produk");
    expect(String(result)).toContain("Cumi-Cumi Beku 1kg");
    expect(String(result)).toContain("Cumi-Cumi Beku 500g");
  });
});

describe("cari_sop", () => {
  it("mengembalikan konteks beserta sumber", async () => {
    mockedSearch.mockResolvedValue([
      { source: "sop-retur-barang.md", content: "Verifikasi maksimal 1x24 jam", score: 0.9 },
    ]);
    const result = await findTool("cari_sop").invoke({ query: "SOP retur" });
    expect(String(result)).toContain("sop-retur-barang.md");
    expect(String(result)).toContain("1x24 jam");
  });

  it("menyatakan tidak ada SOP bila knowledge base kosong", async () => {
    mockedSearch.mockResolvedValue([]);
    const result = await findTool("cari_sop").invoke({ query: "topik tidak ada" });
    expect(String(result).toLowerCase()).toContain("tidak ada sop");
  });
});

describe("cari_produk", () => {
  it("menampilkan katalog produk dari backend", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            sku: "AM-1L",
            name: "Air Mineral Botol 1 Liter",
            unit: "dus",
            stock: 294,
            category: "Minuman",
            lowStock: false,
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    } as never);
    const result = await findTool("cari_produk").invoke({ q: "air" });
    expect(String(result)).toContain("Air Mineral Botol 1 Liter");
    expect(String(result)).toContain("294");
    expect(mockedGet).toHaveBeenCalledWith("/reports/products", { params: { q: "air" } });
  });
});

describe("list_transaksi", () => {
  it("memetakan arah 'masuk' ke type IN dan menampilkan transaksi", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            date: "2026-09-10 08:00",
            type: "IN",
            product: "Keripik Singkong",
            sku: "KRP-01",
            quantity: 20,
            unit: "bal",
            warehouse: "Gudang Utama",
            partner: "UD Sejahtera",
            poNumber: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        unmatched: [],
      },
    } as never);
    const result = await findTool("list_transaksi").invoke({
      direction: "masuk",
      from: "2026-09-10",
      to: "2026-09-23",
    });
    expect(String(result)).toContain("MASUK");
    expect(String(result)).toContain("Keripik Singkong");
    expect(mockedGet).toHaveBeenCalledWith("/reports/transactions", {
      params: { type: "IN", from: "2026-09-10", to: "2026-09-23" },
    });
  });

  it("melaporkan filter yang tidak ditemukan bila hasil kosong", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        unmatched: ['produk "X"'],
      },
    } as never);
    const result = await findTool("list_transaksi").invoke({ productName: "X" });
    expect(String(result)).toContain("Tidak ada transaksi");
    expect(String(result)).toContain("tidak ditemukan");
  });

  it("menyebutkan daftar produk yang cocok dari filter (regresi substring)", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            date: "2026-09-05 10:00",
            type: "OUT",
            product: "Tepung Tapioka Test",
            sku: "TPG-001",
            quantity: 5,
            unit: "sak",
            warehouse: "Gudang Test",
            partner: "Agen Nusantara",
            poNumber: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        unmatched: [],
        matched: {
          products: ["Tepung Tapioka Test", "Tepung Terigu Test"],
          warehouses: [],
          partners: [],
        },
      },
    } as never);
    const result = await findTool("list_transaksi").invoke({
      direction: "keluar",
      productName: "tepung",
    });
    expect(String(result)).toContain("Filter cocok");
    expect(String(result)).toContain("Tepung Terigu Test");
  });
});

describe("list_po", () => {
  it("menampilkan daftar PO sesuai status", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            poNumber: "PO-202609-001",
            status: "CONFIRMED",
            partner: "CV Sumber Frozen",
            targetDate: null,
            createdAt: "2026-09-22 10:00",
            items: [{ product: "Dimsum", quantity: 50, unit: "pack" }],
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        unmatched: [],
      },
    } as never);
    const result = await findTool("list_po").invoke({ status: "CONFIRMED" });
    expect(String(result)).toContain("PO-202609-001");
    expect(String(result)).toContain("CONFIRMED");
    expect(mockedGet).toHaveBeenCalledWith("/reports/purchase-orders", {
      params: { status: "CONFIRMED" },
    });
  });
});

describe("stok_tipis", () => {
  it("menampilkan produk dengan stok di bawah minimum", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{ name: "Nugget Ayam", sku: "NGT-01", stock: 3, minStock: 10, unit: "pack" }],
      },
    } as never);
    const result = await findTool("stok_tipis").invoke({});
    expect(String(result)).toContain("Nugget Ayam");
    expect(mockedGet).toHaveBeenCalledWith("/reports/low-stock");
  });
});
