import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendGateway } from "../src/application/ports/backendGateway";
import type { KnowledgeBase } from "../src/application/ports/knowledgeBase";
import { buildTools } from "../src/application/tools";

function makeDeps() {
  const backend = {
    resolveChatUser: vi.fn(),
    logConversation: vi.fn(),
    getStockByProductName: vi.fn(),
    getShipmentRecap: vi.fn(),
    listProducts: vi.fn(),
    listCategories: vi.fn(),
    listPartners: vi.fn(),
    listWarehouses: vi.fn(),
    listInventory: vi.fn(),
    listTransactions: vi.fn(),
    listPurchaseOrders: vi.fn(),
    getPurchaseOrder: vi.fn(),
    listDeliveryNotes: vi.fn(),
    getLowStock: vi.fn(),
    getDashboard: vi.fn(),
    createPoDraft: vi.fn(),
    createDnDraft: vi.fn(),
  } as unknown as BackendGateway;
  const knowledge = { search: vi.fn() } as unknown as KnowledgeBase;
  return { backend, knowledge };
}

let deps: ReturnType<typeof makeDeps>;

function findTool(name: string) {
  const tool = buildTools(deps, "900001").find((t) => t.name === name);
  if (!tool) throw new Error(`tool ${name} tidak ditemukan`);
  return tool;
}

beforeEach(() => {
  deps = makeDeps();
});

describe("buildTools", () => {
  it("mendaftarkan seluruh tool baca data (FSD §10.2)", () => {
    const names = buildTools(deps, "900001")
      .map((t) => t.name)
      .sort();
    expect(names).toEqual([
      "buat_draft_po",
      "buat_draft_surat_jalan",
      "cari_laporan",
      "cari_nama_produk",
      "cari_produk",
      "cari_sop",
      "cek_stok_barang",
      "detail_po",
      "list_gudang",
      "list_kategori",
      "list_partner",
      "list_po",
      "list_po_status",
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
    vi.mocked(deps.backend.getStockByProductName).mockResolvedValue({
      status: "ok",
      product: { name: "Dimsum Ayam", sku: "DMS-01", stock: 120, unit: "pack" },
      candidates: [],
      suggestions: [],
    });
    const result = await findTool("cek_stok_barang").invoke({ productName: "dimsum" });
    expect(String(result)).toContain("120");
    expect(String(result)).toContain("DMS-01");
    expect(deps.backend.getStockByProductName).toHaveBeenCalledWith("dimsum");
  });

  it("menampilkan kandidat varian bila nama ambigu", async () => {
    vi.mocked(deps.backend.getStockByProductName).mockResolvedValue({
      status: "ambiguous",
      product: null,
      candidates: [
        { name: "Bihun Instan Rasa Original", sku: "INS-007", stock: 12, unit: "pack" },
        { name: "Bihun Instan Rasa Pedas", sku: "INS-009", stock: 8, unit: "pack" },
      ],
      suggestions: [],
    });
    const result = await findTool("cek_stok_barang").invoke({ productName: "bihun" });
    expect(String(result)).toContain("beberapa produk");
    expect(String(result)).toContain("Bihun Instan Rasa Original");
    expect(String(result)).toContain("Bihun Instan Rasa Pedas");
  });

  it("minta klarifikasi bila produk tidak ditemukan (anti-halusinasi)", async () => {
    vi.mocked(deps.backend.getStockByProductName).mockResolvedValue({
      status: "none",
      product: null,
      candidates: [],
      suggestions: [],
    });
    const result = await findTool("cek_stok_barang").invoke({ productName: "tidak ada" });
    expect(String(result).toLowerCase()).toContain("tidak menemukan");
  });
});

describe("buat_draft_po", () => {
  it("mengirim chatId dan source AI_CHAT ke backend", async () => {
    vi.mocked(deps.backend.createPoDraft).mockResolvedValue({
      poNumber: "PO-202609-001",
      partner: { name: "CV Sumber Frozen" },
    });
    const result = await findTool("buat_draft_po").invoke({
      partnerName: "CV Sumber Frozen",
      items: [{ productName: "Dimsum", qty: 50 }],
    });
    expect(String(result)).toContain("PO-202609-001");
    expect(deps.backend.createPoDraft).toHaveBeenCalledWith(
      expect.objectContaining({ source: "AI_CHAT", chatId: "900001" }),
    );
  });

  it("menangani kegagalan backend dengan pesan ramah", async () => {
    vi.mocked(deps.backend.createPoDraft).mockRejectedValue({
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
    vi.mocked(deps.backend.createDnDraft).mockResolvedValue({
      dnNumber: "DN-202609-001",
      partner: { name: "Agen Bahari" },
    });
    const result = await findTool("buat_draft_surat_jalan").invoke({
      partnerName: "Agen Bahari",
      items: [{ productName: "Dimsum", qty: 10 }],
    });
    expect(String(result)).toContain("DN-202609-001");
    expect(String(result)).toContain("DRAFT");
    expect(deps.backend.createDnDraft).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "900001" }),
    );
  });

  it("menangani kegagalan backend dengan pesan ramah", async () => {
    vi.mocked(deps.backend.createDnDraft).mockRejectedValue({
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
    vi.mocked(deps.backend.createDnDraft).mockRejectedValue({
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
    vi.mocked(deps.knowledge.search).mockResolvedValue([
      {
        source: "sop-retur-barang.md",
        title: "SOP Retur",
        docType: "sop",
        content: "Verifikasi maksimal 1x24 jam",
        score: 0.9,
      },
    ]);
    const result = await findTool("cari_sop").invoke({ query: "SOP retur" });
    expect(String(result)).toContain("sop-retur-barang.md");
    expect(String(result)).toContain("1x24 jam");
  });

  it("menyatakan tidak ada SOP bila knowledge base kosong", async () => {
    vi.mocked(deps.knowledge.search).mockResolvedValue([]);
    const result = await findTool("cari_sop").invoke({ query: "topik tidak ada" });
    expect(String(result).toLowerCase()).toContain("tidak ada sop");
  });
});

describe("routing & akses RAG", () => {
  function toolFor(name: string, role?: string) {
    const tool = buildTools(deps, "900001", role).find((t) => t.name === name);
    if (!tool) throw new Error(`tool ${name} tidak ditemukan`);
    return tool;
  }

  it("cari_nama_produk mencari docType kamus-produk", async () => {
    vi.mocked(deps.knowledge.search).mockResolvedValue([]);
    await toolFor("cari_nama_produk").invoke({ q: "cumi2 beku" });
    expect(deps.knowledge.search).toHaveBeenCalledWith(
      "cumi2 beku",
      expect.objectContaining({ docTypes: ["kamus-produk"] }),
    );
  });

  it("cari_laporan mencari docType laporan", async () => {
    vi.mocked(deps.knowledge.search).mockResolvedValue([]);
    await toolFor("cari_laporan").invoke({ query: "tren bulan lalu" });
    expect(deps.knowledge.search).toHaveBeenCalledWith(
      "tren bulan lalu",
      expect.objectContaining({ docTypes: ["laporan"] }),
    );
  });

  it("ADMIN tidak diberi akses docType sensitif", async () => {
    vi.mocked(deps.knowledge.search).mockResolvedValue([]);
    await toolFor("cari_sop", "ADMIN").invoke({ query: "syarat bayar supplier" });
    const opts = vi.mocked(deps.knowledge.search).mock.calls.at(-1)?.[1] as { docTypes: string[] };
    expect(opts.docTypes).not.toContain("catatan-partner");
    expect(opts.docTypes).not.toContain("kontrak");
  });

  it("OWNER boleh akses docType sensitif", async () => {
    vi.mocked(deps.knowledge.search).mockResolvedValue([]);
    await toolFor("cari_sop", "OWNER").invoke({ query: "isi kontrak supplier" });
    const opts = vi.mocked(deps.knowledge.search).mock.calls.at(-1)?.[1] as { docTypes: string[] };
    expect(opts.docTypes).toContain("kontrak");
  });

  it("menolak docType sensitif bila diminta eksplisit oleh ADMIN", async () => {
    const result = await toolFor("cari_sop", "ADMIN").invoke({ query: "x", docType: "kontrak" });
    expect(String(result).toLowerCase()).toContain("tidak memiliki akses");
    expect(deps.knowledge.search).not.toHaveBeenCalled();
  });
});

describe("cari_produk", () => {
  it("menampilkan katalog produk dari backend", async () => {
    vi.mocked(deps.backend.listProducts).mockResolvedValue({
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
    });
    const result = await findTool("cari_produk").invoke({ q: "air" });
    expect(String(result)).toContain("Air Mineral Botol 1 Liter");
    expect(String(result)).toContain("294");
    expect(deps.backend.listProducts).toHaveBeenCalledWith({ q: "air" });
  });
});

describe("list_transaksi", () => {
  it("memetakan arah 'masuk' ke type IN dan menampilkan transaksi", async () => {
    vi.mocked(deps.backend.listTransactions).mockResolvedValue({
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
    });
    const result = await findTool("list_transaksi").invoke({
      direction: "masuk",
      from: "2026-09-10",
      to: "2026-09-23",
    });
    expect(String(result)).toContain("MASUK");
    expect(String(result)).toContain("Keripik Singkong");
    expect(deps.backend.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ type: "IN", from: "2026-09-10", to: "2026-09-23" }),
    );
  });

  it("melaporkan filter yang tidak ditemukan bila hasil kosong", async () => {
    vi.mocked(deps.backend.listTransactions).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      unmatched: ['produk "X"'],
    });
    const result = await findTool("list_transaksi").invoke({ productName: "X" });
    expect(String(result)).toContain("Tidak ada transaksi");
    expect(String(result)).toContain("tidak ditemukan");
  });

  it("menyebutkan daftar produk yang cocok dari filter (regresi substring)", async () => {
    vi.mocked(deps.backend.listTransactions).mockResolvedValue({
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
    });
    const result = await findTool("list_transaksi").invoke({
      direction: "keluar",
      productName: "tepung",
    });
    expect(String(result)).toContain("Filter cocok");
    expect(String(result)).toContain("Tepung Terigu Test");
  });
});

describe("list_po", () => {
  it("selalu menampilkan PO aktif (DRAFT & CONFIRMED) tanpa filter status", async () => {
    vi.mocked(deps.backend.listPurchaseOrders).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      unmatched: [],
    });
    await findTool("list_po").invoke({ partnerName: "PT Sinar" });
    expect(deps.backend.listPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: "DRAFT,CONFIRMED", partnerName: "PT Sinar" }),
    );
  });

  it("mengabaikan filter status yang keliru (regresi: PO confirmed tidak hilang)", async () => {
    vi.mocked(deps.backend.listPurchaseOrders).mockResolvedValue({
      data: [
        {
          poNumber: "PO-202609-011",
          status: "CONFIRMED",
          partner: "UD Amanah",
          targetDate: null,
          createdAt: "2026-09-24 05:49",
          items: [{ product: "Bayam Ikat 250g", quantity: 200, unit: "pack" }],
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      unmatched: [],
    });
    const result = await findTool("list_po").invoke({
      status: "DRAFT",
      partnerName: "UD Amanah",
    } as never);
    expect(deps.backend.listPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: "DRAFT,CONFIRMED", partnerName: "UD Amanah" }),
    );
    expect(String(result)).toContain("CONFIRMED");
  });
});

describe("list_po_status", () => {
  it("memfilter PO sesuai status yang disebut eksplisit", async () => {
    vi.mocked(deps.backend.listPurchaseOrders).mockResolvedValue({
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
    });
    const result = await findTool("list_po_status").invoke({ statuses: ["CONFIRMED"] });
    expect(String(result)).toContain("PO-202609-001");
    expect(String(result)).toContain("CONFIRMED");
    expect(deps.backend.listPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: "CONFIRMED" }),
    );
  });

  it("mendukung beberapa status sekaligus", async () => {
    vi.mocked(deps.backend.listPurchaseOrders).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      unmatched: [],
    });
    await findTool("list_po_status").invoke({ statuses: ["COMPLETED", "CANCELLED"] });
    expect(deps.backend.listPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: "COMPLETED,CANCELLED" }),
    );
  });
});

describe("stok_tipis", () => {
  it("menampilkan produk dengan stok di bawah minimum", async () => {
    vi.mocked(deps.backend.getLowStock).mockResolvedValue([
      { name: "Nugget Ayam", sku: "NGT-01", stock: 3, minStock: 10, unit: "pack" },
    ]);
    const result = await findTool("stok_tipis").invoke({});
    expect(String(result)).toContain("Nugget Ayam");
    expect(deps.backend.getLowStock).toHaveBeenCalled();
  });
});
