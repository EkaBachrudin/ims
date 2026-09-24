import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "../config/env";
import { backend } from "../services/backendClient";
import { searchKnowledge } from "../rag/retriever";

interface StockRow {
  name: string;
  sku: string;
  stock: number;
  unit: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ListResponse<T> {
  data: T[];
  meta?: Meta;
  unmatched?: string[];
  matched?: MatchedNames;
}

interface MatchedNames {
  products?: string[];
  warehouses?: string[];
  partners?: string[];
}

const stockSchema = z.object({
  productName: z.string().describe("Nama barang, mis. 'dimsum'"),
});
type StockInput = z.infer<typeof stockSchema>;

const shipmentSchema = z.object({
  date: z
    .string()
    .describe(
      "Tanggal format YYYY-MM-DD. Konversi tanggal relatif (kemarin, besok) ke format ini.",
    ),
});
type ShipmentInput = z.infer<typeof shipmentSchema>;

const poSchema = z.object({
  partnerName: z.string().describe("Nama supplier, mis. 'CV Sumber Frozen'"),
  items: z
    .array(z.object({ productName: z.string(), qty: z.number().int().positive() }))
    .min(1)
    .describe("Daftar barang yang dipesan"),
  targetDate: z.string().optional().describe("Tanggal target format YYYY-MM-DD (opsional)"),
});
type PoInput = z.infer<typeof poSchema>;

const dnDraftSchema = z.object({
  partnerName: z.string().describe("Nama customer, mis. 'Agen Bahari'"),
  items: z
    .array(z.object({ productName: z.string(), qty: z.number().int().positive() }))
    .min(1)
    .describe("Daftar barang yang dikirim"),
  shipDate: z
    .string()
    .optional()
    .describe("Tanggal kirim format YYYY-MM-DD (opsional, default hari ini)"),
  warehouseCode: z.string().optional().describe("Kode/nama gudang asal (opsional)"),
});
type DnDraftInput = z.infer<typeof dnDraftSchema>;

const sopSchema = z.object({
  query: z.string().describe("Pertanyaan/kata kunci pengguna"),
});
type SopInput = z.infer<typeof sopSchema>;

const productSearchSchema = z.object({
  q: z
    .string()
    .optional()
    .describe("Kata kunci nama/SKU produk (opsional). Kosongkan untuk semua produk."),
});
type ProductSearchInput = z.infer<typeof productSearchSchema>;

const partnerSearchSchema = z.object({
  q: z.string().optional().describe("Kata kunci nama partner (opsional)"),
  type: z.enum(["SUPPLIER", "CUSTOMER"]).optional().describe("Filter tipe partner (opsional)"),
});
type PartnerSearchInput = z.infer<typeof partnerSearchSchema>;

const inventorySchema = z.object({
  productName: z.string().optional().describe("Nama produk (opsional)"),
  warehouseCode: z.string().optional().describe("Kode atau nama gudang (opsional)"),
});
type InventoryInput = z.infer<typeof inventorySchema>;

const transactionSchema = z.object({
  direction: z
    .enum(["masuk", "keluar", "penyesuaian"])
    .optional()
    .describe(
      "Arah transaksi: 'masuk' (inbound), 'keluar' (outbound), 'penyesuaian'. Kosongkan untuk semua.",
    ),
  from: z.string().optional().describe("Tanggal awal format YYYY-MM-DD (opsional)"),
  to: z.string().optional().describe("Tanggal akhir format YYYY-MM-DD (opsional)"),
  productName: z.string().optional().describe("Nama produk (opsional)"),
  warehouseCode: z.string().optional().describe("Kode atau nama gudang (opsional)"),
  partnerName: z.string().optional().describe("Nama partner/supplier/customer (opsional)"),
});
type TransactionInput = z.infer<typeof transactionSchema>;

const poListSchema = z.object({
  status: z
    .enum(["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"])
    .optional()
    .describe("Filter status PO (opsional)"),
  partnerName: z.string().optional().describe("Nama supplier (opsional)"),
  from: z.string().optional().describe("Tanggal awal dibuat format YYYY-MM-DD (opsional)"),
  to: z.string().optional().describe("Tanggal akhir dibuat format YYYY-MM-DD (opsional)"),
});
type PoListInput = z.infer<typeof poListSchema>;

const poDetailSchema = z.object({
  poNumber: z.string().describe("Nomor PO, mis. 'PO-202609-001'"),
});
type PoDetailInput = z.infer<typeof poDetailSchema>;

const dnListSchema = z.object({
  status: z
    .enum(["DRAFT", "SHIPPED", "DELIVERED", "CANCELLED"])
    .optional()
    .describe("Filter status surat jalan (opsional)"),
  partnerName: z.string().optional().describe("Nama customer (opsional)"),
  from: z.string().optional().describe("Tanggal kirim awal format YYYY-MM-DD (opsional)"),
  to: z.string().optional().describe("Tanggal kirim akhir format YYYY-MM-DD (opsional)"),
});
type DnListInput = z.infer<typeof dnListSchema>;

const DIRECTION_TO_TYPE: Record<string, "IN" | "OUT" | "ADJUSTMENT"> = {
  masuk: "IN",
  keluar: "OUT",
  penyesuaian: "ADJUSTMENT",
};

const TYPE_LABEL: Record<string, string> = {
  IN: "MASUK",
  OUT: "KELUAR",
  ADJUSTMENT: "PENYESUAIAN",
};

function paramsOf(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ""));
}

function unmatchedNote(unmatched?: string[]): string {
  return unmatched?.length ? `\nCatatan: tidak ditemukan ${unmatched.join(", ")}.` : "";
}

function matchedNote(matched?: MatchedNames): string {
  if (!matched) return "";
  const parts: string[] = [];
  if (matched.products?.length) parts.push(`produk: ${matched.products.join(", ")}`);
  if (matched.warehouses?.length) parts.push(`gudang: ${matched.warehouses.join(", ")}`);
  if (matched.partners?.length) parts.push(`partner: ${matched.partners.join(", ")}`);
  return parts.length ? `\nFilter cocok → ${parts.join(" | ")}` : "";
}

async function fetchList<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<ListResponse<T>> {
  const { data } = await backend.get(path, { params: paramsOf(params) });
  return {
    data: (data.data ?? []) as T[],
    meta: data.meta as Meta | undefined,
    unmatched: data.unmatched,
    matched: data.matched as MatchedNames | undefined,
  };
}

export function buildTools(chatId: string) {
  const checkStock = new DynamicStructuredTool({
    name: "cek_stok_barang",
    description:
      "Cek sisa stok satu barang berdasarkan nama. Untuk mencari/menampilkan banyak produk atau varian, gunakan cari_produk.",
    schema: stockSchema,
    func: async (input: StockInput): Promise<string> => {
      const { data } = await backend.get(`/reports/stock/${encodeURIComponent(input.productName)}`);
      const p = data.data as StockRow | null;
      if (!p) {
        return `Sistem tidak menemukan barang bernama mirip "${input.productName}". Minta user menyebutkan nama lain.`;
      }
      return `Info database: ${p.name} (SKU: ${p.sku}) stok ${p.stock} ${p.unit}.`;
    },
  });

  const shipmentRecap = new DynamicStructuredTool({
    name: "rekap_pengiriman",
    description:
      "Rekap BARANG KELUAR (pengiriman) pada SATU tanggal tertentu. Gunakan saat user menanyakan kirim ke mana pada tanggal tertentu.",
    schema: shipmentSchema,
    func: async (input: ShipmentInput): Promise<string> => {
      const { data } = await backend.get("/reports/shipments", { params: { date: input.date } });
      const shipments = (data.data?.shipments ?? []) as {
        partner: string;
        product: string;
        qty: number;
        unit: string;
        warehouse: string;
      }[];
      if (shipments.length === 0) return `Tidak ada pengiriman tercatat pada ${input.date}.`;
      return shipments
        .map((r) => `- ${r.partner}: ${r.qty} ${r.unit} ${r.product} (${r.warehouse})`)
        .join("\n");
    },
  });

  const createPoDraft = new DynamicStructuredTool({
    name: "buat_draft_po",
    description:
      "Membuat draft Purchase Order (PO) baru. Status selalu DRAFT dan wajib dikonfirmasi admin di web.",
    schema: poSchema,
    func: async (input: PoInput): Promise<string> => {
      try {
        const { data } = await backend.post("/po/draft", {
          partnerName: input.partnerName,
          items: input.items,
          targetDate: input.targetDate ?? undefined,
          source: "AI_CHAT",
          chatId,
        });
        const po = data.data;
        return `Draft PO ${po.poNumber} untuk ${po.partner.name} berhasil dibuat (status DRAFT). Silakan konfirmasi di aplikasi web.`;
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: { message?: string } } } };
        return `Gagal membuat PO: ${err.response?.data?.error?.message ?? "kesalahan sistem"}.`;
      }
    },
  });

  const createDnDraft = new DynamicStructuredTool({
    name: "buat_draft_surat_jalan",
    description:
      "Membuat draft Surat Jalan (Delivery Note) untuk partner CUSTOMER. Status selalu DRAFT; stok baru berkurang saat surat jalan dikirim (SHIPPED). Wajib dikonfirmasi/dikirim admin di web.",
    schema: dnDraftSchema,
    func: async (input: DnDraftInput): Promise<string> => {
      try {
        const { data } = await backend.post("/delivery-notes/draft", {
          partnerName: input.partnerName,
          items: input.items,
          shipDate: input.shipDate ?? undefined,
          warehouseCode: input.warehouseCode ?? undefined,
          chatId,
        });
        const dn = data.data;
        return `Draft Surat Jalan ${dn.dnNumber} untuk ${dn.partner.name} berhasil dibuat (status DRAFT). Stok belum berkurang; silakan konfirmasi/kirim di aplikasi web.`;
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: { message?: string } } } };
        return `Gagal membuat Surat Jalan: ${err.response?.data?.error?.message ?? "kesalahan sistem"}.`;
      }
    },
  });

  const searchSop = new DynamicStructuredTool({
    name: "cari_sop",
    description:
      "Mencari SOP, kebijakan, panduan internal, atau penjelasan istilah/skema data. Gunakan untuk pertanyaan prosedural yang bukan data transaksional.",
    schema: sopSchema,
    func: async (input: SopInput): Promise<string> => {
      const chunks = await searchKnowledge(input.query, env.AGENT_TOP_K);
      if (chunks.length === 0) return "Tidak ada SOP/panduan yang relevan di knowledge base.";
      return chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.content}`).join("\n\n");
    },
  });

  const searchProduct = new DynamicStructuredTool({
    name: "cari_produk",
    description:
      "Mencari/menampilkan daftar produk (katalog) beserta SKU, kategori, stok, dan satuan. Gunakan untuk pertanyaan varian/ukuran lain atau daftar barang.",
    schema: productSearchSchema,
    func: async (input: ProductSearchInput): Promise<string> => {
      const { data, meta } = await fetchList<{
        sku: string;
        name: string;
        unit: string;
        stock: number;
        category: string | null;
        lowStock: boolean;
      }>("/reports/products", { q: input.q });
      if (data.length === 0) return "Tidak ada produk yang cocok.";
      const lines = data.map(
        (p) =>
          `- ${p.name} (SKU ${p.sku}, ${p.category ?? "tanpa kategori"}) stok ${p.stock} ${p.unit}${
            p.lowStock ? " [STOK TIPIS]" : ""
          }`,
      );
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} produk.`;
    },
  });

  const listCategories = new DynamicStructuredTool({
    name: "list_kategori",
    description: "Menampilkan daftar kategori produk beserta jumlah produknya.",
    schema: z.object({}),
    func: async (): Promise<string> => {
      const { data } = await backend.get("/reports/categories");
      const rows = (data.data ?? []) as { name: string; productCount: number }[];
      if (rows.length === 0) return "Belum ada kategori.";
      return rows.map((c) => `- ${c.name} (${c.productCount} produk)`).join("\n");
    },
  });

  const listPartners = new DynamicStructuredTool({
    name: "list_partner",
    description: "Menampilkan daftar partner (supplier/customer) dengan tipe dan kontaknya.",
    schema: partnerSearchSchema,
    func: async (input: PartnerSearchInput): Promise<string> => {
      const { data, meta } = await fetchList<{
        name: string;
        type: string;
        phone: string | null;
        email: string | null;
      }>("/reports/partners", { q: input.q, type: input.type });
      if (data.length === 0) return "Tidak ada partner yang cocok.";
      const lines = data.map(
        (p) =>
          `- ${p.name} [${p.type}]${p.phone ? ` telp ${p.phone}` : ""}${p.email ? ` email ${p.email}` : ""}`,
      );
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} partner.`;
    },
  });

  const listWarehouses = new DynamicStructuredTool({
    name: "list_gudang",
    description: "Menampilkan daftar gudang beserta kode dan status aktifnya.",
    schema: z.object({}),
    func: async (): Promise<string> => {
      const { data } = await backend.get("/reports/warehouses");
      const rows = (data.data ?? []) as { code: string; name: string; isActive: boolean }[];
      if (rows.length === 0) return "Belum ada gudang.";
      return rows
        .map((w) => `- ${w.name} (${w.code})${w.isActive ? "" : " [NONAKTIF]"}`)
        .join("\n");
    },
  });

  const stockPerWarehouse = new DynamicStructuredTool({
    name: "stok_per_gudang",
    description: "Menampilkan rincian stok per gudang untuk suatu produk (atau semua produk).",
    schema: inventorySchema,
    func: async (input: InventoryInput): Promise<string> => {
      const { data, meta } = await fetchList<{
        product: string;
        sku: string;
        unit: string;
        warehouse: string;
        quantity: number;
      }>("/reports/inventory", {
        productName: input.productName,
        warehouseCode: input.warehouseCode,
      });
      if (data.length === 0) return "Tidak ada data stok per gudang yang cocok.";
      const lines = data.map((r) => `- ${r.product} di ${r.warehouse}: ${r.quantity} ${r.unit}`);
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} baris.`;
    },
  });

  const listTransactions = new DynamicStructuredTool({
    name: "list_transaksi",
    description:
      "Menampilkan daftar transaksi stok (BARANG MASUK / BARANG KELUAR / penyesuaian) dengan filter rentang tanggal, produk, gudang, dan partner. Gunakan ini untuk pertanyaan 'barang masuk/keluar' (bukan rekap_pengiriman yang hanya keluar pada satu tanggal).",
    schema: transactionSchema,
    func: async (input: TransactionInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await fetchList<{
        date: string;
        type: string;
        product: string;
        sku: string;
        quantity: number;
        unit: string;
        warehouse: string;
        partner: string | null;
        poNumber: string | null;
      }>("/reports/transactions", {
        type: input.direction ? DIRECTION_TO_TYPE[input.direction] : undefined,
        from: input.from,
        to: input.to,
        productName: input.productName,
        warehouseCode: input.warehouseCode,
        partnerName: input.partnerName,
      });
      if (data.length === 0)
        return `Tidak ada transaksi yang cocok dengan filter tersebut.${unmatchedNote(unmatched)}`;
      const lines = data.map(
        (r) =>
          `- [${r.date}] ${TYPE_LABEL[r.type] ?? r.type} ${r.quantity} ${r.unit} ${r.product} | gudang ${r.warehouse}${
            r.partner ? ` | partner ${r.partner}` : ""
          }${r.poNumber ? ` | PO ${r.poNumber}` : ""}`,
      );
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} transaksi.${matchedNote(matched)}${unmatchedNote(unmatched)}`;
    },
  });

  const listPos = new DynamicStructuredTool({
    name: "list_po",
    description:
      "Menampilkan daftar Purchase Order (PO) dengan filter status, supplier, dan rentang tanggal pembuatan.",
    schema: poListSchema,
    func: async (input: PoListInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await fetchList<{
        poNumber: string;
        status: string;
        partner: string;
        targetDate: string | null;
        createdAt: string;
        items: { product: string; quantity: number; unit: string }[];
      }>("/reports/purchase-orders", {
        status: input.status,
        partnerName: input.partnerName,
        from: input.from,
        to: input.to,
      });
      if (data.length === 0)
        return `Tidak ada PO yang cocok dengan filter tersebut.${unmatchedNote(unmatched)}`;
      const lines = data.map((po) => {
        const items = po.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ");
        return `- ${po.poNumber} [${po.status}] ${po.partner} | ${items} | dibuat ${po.createdAt}${
          po.targetDate ? ` | target ${po.targetDate}` : ""
        }`;
      });
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} PO.${matchedNote(matched)}${unmatchedNote(unmatched)}`;
    },
  });

  const detailPo = new DynamicStructuredTool({
    name: "detail_po",
    description:
      "Menampilkan detail satu Purchase Order berdasarkan nomor PO, termasuk realisasi penerimaan.",
    schema: poDetailSchema,
    func: async (input: PoDetailInput): Promise<string> => {
      const { data } = await backend.get(
        `/reports/purchase-orders/${encodeURIComponent(input.poNumber)}`,
      );
      const po = data.data as {
        poNumber: string;
        status: string;
        partner: string;
        warehouse: string | null;
        targetDate: string | null;
        items: {
          product: string;
          ordered: number;
          received: number;
          remaining: number;
          unit: string;
        }[];
      } | null;
      if (!po) return `PO dengan nomor "${input.poNumber}" tidak ditemukan.`;
      const items = po.items
        .map(
          (i) =>
            `  • ${i.product}: pesan ${i.ordered} ${i.unit}, diterima ${i.received}, sisa ${i.remaining}`,
        )
        .join("\n");
      return `PO ${po.poNumber} [${po.status}] supplier ${po.partner}${
        po.warehouse ? `, gudang ${po.warehouse}` : ""
      }${po.targetDate ? `, target ${po.targetDate}` : ""}\n${items}`;
    },
  });

  const listDeliveryNotes = new DynamicStructuredTool({
    name: "list_surat_jalan",
    description:
      "Menampilkan daftar Surat Jalan / Delivery Note dengan filter status, customer, dan rentang tanggal kirim.",
    schema: dnListSchema,
    func: async (input: DnListInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await fetchList<{
        dnNumber: string;
        status: string;
        shipDate: string;
        poNumber: string | null;
        partner: string;
        warehouse: string;
        items: { product: string; quantity: number; unit: string }[];
      }>("/reports/delivery-notes", {
        status: input.status,
        partnerName: input.partnerName,
        from: input.from,
        to: input.to,
      });
      if (data.length === 0) return `Tidak ada surat jalan yang cocok.${unmatchedNote(unmatched)}`;
      const lines = data.map((dn) => {
        const items = dn.items.map((i) => `${i.quantity} ${i.unit} ${i.product}`).join(", ");
        return `- ${dn.dnNumber} [${dn.status}] ${dn.partner} | kirim ${dn.shipDate} | ${items}${
          dn.poNumber ? ` | PO ${dn.poNumber}` : ""
        }`;
      });
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} surat jalan.${matchedNote(matched)}${unmatchedNote(unmatched)}`;
    },
  });

  const lowStock = new DynamicStructuredTool({
    name: "stok_tipis",
    description:
      "Menampilkan daftar produk yang stoknya sudah mencapai/di bawah batas minimum (stok tipis).",
    schema: z.object({}),
    func: async (): Promise<string> => {
      const { data } = await backend.get("/reports/low-stock");
      const rows = (data.data ?? []) as {
        name: string;
        sku: string;
        stock: number;
        minStock: number;
        unit: string;
      }[];
      if (rows.length === 0) return "Tidak ada produk dengan stok tipis.";
      return rows
        .map((p) => `- ${p.name} (SKU ${p.sku}): stok ${p.stock} ${p.unit} (min ${p.minStock})`)
        .join("\n");
    },
  });

  const dashboardSummary = new DynamicStructuredTool({
    name: "ringkasan_dashboard",
    description:
      "Menampilkan ringkasan operasional: total produk, jumlah PO aktif, transaksi masuk/keluar hari ini, jumlah stok tipis, dan transaksi terbaru.",
    schema: z.object({}),
    func: async (): Promise<string> => {
      const { data } = await backend.get("/reports/dashboard");
      const d = data.data as {
        totalProducts: number;
        activePOs: number;
        todayInbound: number;
        todayOutbound: number;
        lowStockCount: number;
        recentTransactions: {
          type: string;
          quantity: number;
          createdAt: string;
          product: { name: string; unit: string };
          warehouse: { name: string };
        }[];
      };
      const recent = d.recentTransactions
        .slice(0, 5)
        .map(
          (t) =>
            `  • ${TYPE_LABEL[t.type] ?? t.type} ${t.quantity} ${t.product.unit} ${t.product.name} (${t.warehouse.name})`,
        )
        .join("\n");
      return `Ringkasan hari ini:\n- Total produk: ${d.totalProducts}\n- PO aktif: ${d.activePOs}\n- Barang masuk hari ini: ${d.todayInbound}\n- Barang keluar hari ini: ${d.todayOutbound}\n- Produk stok tipis: ${d.lowStockCount}\nTransaksi terbaru:\n${recent}`;
    },
  });

  return [
    checkStock,
    shipmentRecap,
    createPoDraft,
    createDnDraft,
    searchSop,
    searchProduct,
    listCategories,
    listPartners,
    listWarehouses,
    stockPerWarehouse,
    listTransactions,
    listPos,
    detailPo,
    listDeliveryNotes,
    lowStock,
    dashboardSummary,
  ];
}

export type AgentTools = ReturnType<typeof buildTools>;
