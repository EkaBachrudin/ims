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
  it("mendaftarkan 4 tool sesuai spesifikasi FSD §10.2", () => {
    const names = buildTools("900001").map((t) => t.name).sort();
    expect(names).toEqual(["buat_draft_po", "cari_sop", "cek_stok_barang", "rekap_pengiriman"]);
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
      data: { data: { poNumber: "PO-202609-001", partner: { name: "PT Maju Jaya" } } },
    } as never);
    const result = await findTool("buat_draft_po").invoke({
      partnerName: "PT Maju Jaya",
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
