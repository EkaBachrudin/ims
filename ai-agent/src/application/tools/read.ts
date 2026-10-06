import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { BackendGateway, StockRow } from "../ports/backendGateway";
import {
  DIRECTION_TO_TYPE,
  TYPE_LABEL,
  formatPoList,
  matchedNote,
  shortDate,
  unmatchedNote,
} from "./format";
import {
  type DnListInput,
  type InventoryInput,
  type PartnerSearchInput,
  type PeriodSummaryInput,
  type PoDetailInput,
  type PoListInput,
  type PoStatusListInput,
  type ProductSearchInput,
  type ShipmentInput,
  type StockInput,
  type TransactionInput,
  dnListSchema,
  inventorySchema,
  partnerSearchSchema,
  periodSummarySchema,
  poDetailSchema,
  poListSchema,
  poStatusListSchema,
  productSearchSchema,
  shipmentSchema,
  stockSchema,
  transactionSchema,
} from "./schemas";

export interface ReadToolDeps {
  backend: BackendGateway;
}

export function buildReadTools({ backend }: ReadToolDeps) {
  const checkStock = new DynamicStructuredTool({
    name: "cek_stok_barang",
    description:
      "Cek sisa stok satu barang berdasarkan nama. Bila nama cocok ke beberapa varian, tool mengembalikan daftar kandidat; gunakan cari_produk untuk varian/ukuran lain.",
    schema: stockSchema,
    func: async (input: StockInput): Promise<string> => {
      const result = await backend.getStockByProductName(input.productName);

      if (!result || result.status === "none") {
        const suggestions = result?.suggestions ?? [];
        const hint = suggestions.length
          ? ` Mungkin maksud: ${suggestions.map((s) => `"${s.name}"`).join(", ")}.`
          : "";
        return `Sistem tidak menemukan barang bernama mirip "${input.productName}".${hint} Minta user menyebutkan nama lain.`;
      }

      if (result.status === "ambiguous") {
        const candidates = result.candidates ?? [];
        const lines = candidates.map(
          (c) => `• ${c.name} (SKU ${c.sku}): stok ${c.stock} ${c.unit}`,
        );
        return `Kata kunci "${input.productName}" cocok dengan beberapa produk:\n${lines.join("\n")}\nMohon sebutkan varian yang dimaksud.`;
      }

      const p = result.product as StockRow;
      return `Info database: ${p.name} (SKU: ${p.sku}) stok ${p.stock} ${p.unit}.`;
    },
  });

  const shipmentRecap = new DynamicStructuredTool({
    name: "rekap_pengiriman",
    description:
      "Rekap BARANG KELUAR (pengiriman) pada SATU tanggal tertentu. Gunakan saat user menanyakan kirim ke mana pada tanggal tertentu.",
    schema: shipmentSchema,
    func: async (input: ShipmentInput): Promise<string> => {
      const recap = await backend.getShipmentRecap(input.date);
      const shipments = recap?.shipments ?? [];
      if (shipments.length === 0) return `Tidak ada pengiriman tercatat pada ${input.date}.`;
      return shipments
        .map((r) => `• ${r.partner}: ${r.qty} ${r.unit} ${r.product} (${r.warehouse})`)
        .join("\n");
    },
  });

  const searchProduct = new DynamicStructuredTool({
    name: "cari_produk",
    description:
      "Mencari/menampilkan daftar produk (katalog) beserta SKU, kategori, stok, dan satuan. Gunakan untuk pertanyaan varian/ukuran lain, daftar barang, atau untuk menemukan nama produk persis sebelum membuat PO/Surat Jalan (pakai kata kunci pendek seperti 'cumi').",
    schema: productSearchSchema,
    func: async (input: ProductSearchInput): Promise<string> => {
      const { data, meta } = await backend.listProducts({ q: input.q });
      if (data.length === 0) return "Tidak ada produk yang cocok.";
      const lines = data.map(
        (p) =>
          `• ${p.name} (SKU ${p.sku}, ${p.category ?? "tanpa kategori"}) stok ${p.stock} ${p.unit}${
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
      const rows = await backend.listCategories();
      if (rows.length === 0) return "Belum ada kategori.";
      return rows.map((c) => `• ${c.name} (${c.productCount} produk)`).join("\n");
    },
  });

  const listPartners = new DynamicStructuredTool({
    name: "list_partner",
    description: "Menampilkan daftar partner (supplier/customer) dengan tipe dan kontaknya.",
    schema: partnerSearchSchema,
    func: async (input: PartnerSearchInput): Promise<string> => {
      const { data, meta } = await backend.listPartners({ q: input.q, type: input.type });
      if (data.length === 0) return "Tidak ada partner yang cocok.";
      const lines = data.map(
        (p) =>
          `• ${p.name} [${p.type}]${p.phone ? ` telp ${p.phone}` : ""}${p.email ? ` email ${p.email}` : ""}`,
      );
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} partner.`;
    },
  });

  const listWarehouses = new DynamicStructuredTool({
    name: "list_gudang",
    description: "Menampilkan daftar gudang beserta kode dan status aktifnya.",
    schema: z.object({}),
    func: async (): Promise<string> => {
      const rows = await backend.listWarehouses();
      if (rows.length === 0) return "Belum ada gudang.";
      return rows
        .map((w) => `• ${w.name} (${w.code})${w.isActive ? "" : " [NONAKTIF]"}`)
        .join("\n");
    },
  });

  const stockPerWarehouse = new DynamicStructuredTool({
    name: "stok_per_gudang",
    description: "Menampilkan rincian stok per gudang untuk suatu produk (atau semua produk).",
    schema: inventorySchema,
    func: async (input: InventoryInput): Promise<string> => {
      const { data, meta } = await backend.listInventory({
        productName: input.productName,
        warehouseCode: input.warehouseCode,
      });
      if (data.length === 0) return "Tidak ada data stok per gudang yang cocok.";
      const lines = data.map((r) => `• ${r.product} di ${r.warehouse}: ${r.quantity} ${r.unit}`);
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} baris.`;
    },
  });

  const listTransactions = new DynamicStructuredTool({
    name: "list_transaksi",
    description:
      "Menampilkan daftar transaksi stok (BARANG MASUK / BARANG KELUAR / penyesuaian) dengan filter rentang tanggal, produk, gudang, dan partner. Gunakan ini untuk pertanyaan 'barang masuk/keluar' (bukan rekap_pengiriman yang hanya keluar pada satu tanggal).",
    schema: transactionSchema,
    func: async (input: TransactionInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await backend.listTransactions({
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
          `• [${r.date}] ${TYPE_LABEL[r.type] ?? r.type} ${r.quantity} ${r.unit} ${r.product} — gudang ${r.warehouse}${
            r.partner ? ` — partner ${r.partner}` : ""
          }${r.poNumber ? ` — PO ${r.poNumber}` : ""}`,
      );
      return `${lines.join("\n")}\nTotal: ${meta?.total ?? data.length} transaksi.${matchedNote(matched)}${unmatchedNote(unmatched)}`;
    },
  });

  const listPos = new DynamicStructuredTool({
    name: "list_po",
    description:
      "Menampilkan daftar Purchase Order (PO) AKTIF (status DRAFT & CONFIRMED). Tool ini TIDAK menerima filter status. Bila user menyebut status tertentu (mis. confirmed, completed, cancelled), gunakan list_po_status. Isi `from`/`to` HANYA bila user menyebut rentang tanggal.",
    schema: poListSchema,
    func: async (input: PoListInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await backend.listPurchaseOrders({
        statuses: "DRAFT,CONFIRMED",
        partnerName: input.partnerName,
        from: input.from,
        to: input.to,
      });
      return formatPoList(data, meta, matched, unmatched);
    },
  });

  const listPosByStatus = new DynamicStructuredTool({
    name: "list_po_status",
    description:
      "Menampilkan daftar Purchase Order (PO) dengan status yang disebut user secara eksplisit (mis. 'PO yang confirmed', 'PO completed', 'PO yang dibatalkan'). JANGAN gunakan tool ini bila user tidak menyebut status tertentu.",
    schema: poStatusListSchema,
    func: async (input: PoStatusListInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await backend.listPurchaseOrders({
        statuses: input.statuses.join(","),
        partnerName: input.partnerName,
        from: input.from,
        to: input.to,
      });
      return formatPoList(data, meta, matched, unmatched);
    },
  });

  const detailPo = new DynamicStructuredTool({
    name: "detail_po",
    description:
      "Menampilkan detail satu Purchase Order berdasarkan nomor PO, termasuk realisasi penerimaan.",
    schema: poDetailSchema,
    func: async (input: PoDetailInput): Promise<string> => {
      const po = await backend.getPurchaseOrder(input.poNumber);
      if (!po) return `PO dengan nomor "${input.poNumber}" tidak ditemukan.`;
      const items = po.items
        .map(
          (i) =>
            `• ${i.product}: pesan ${i.ordered} ${i.unit}, diterima ${i.received}, sisa ${i.remaining}`,
        )
        .join("\n");
      return `PO ${po.poNumber} [${po.status}] — supplier ${po.partner}${
        po.warehouse ? `, gudang ${po.warehouse}` : ""
      }${po.targetDate ? `, target ${shortDate(po.targetDate)}` : ""}\n${items}`;
    },
  });

  const listDeliveryNotes = new DynamicStructuredTool({
    name: "list_surat_jalan",
    description:
      "Menampilkan daftar Surat Jalan / Delivery Note dengan filter status, customer, dan rentang tanggal kirim.",
    schema: dnListSchema,
    func: async (input: DnListInput): Promise<string> => {
      const { data, meta, unmatched, matched } = await backend.listDeliveryNotes({
        status: input.status,
        partnerName: input.partnerName,
        from: input.from,
        to: input.to,
      });
      if (data.length === 0) return `Tidak ada surat jalan yang cocok.${unmatchedNote(unmatched)}`;
      const lines = data.flatMap((dn) => {
        return [
          `• ${dn.dnNumber} [${dn.status}] — ${dn.partner}`,
          ...dn.items.map((i) => `  – ${i.quantity} ${i.unit} ${i.product}`),
          `  Kirim ${shortDate(dn.shipDate) ?? dn.shipDate}${dn.poNumber ? ` — PO ${dn.poNumber}` : ""}`,
        ];
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
      const rows = await backend.getLowStock();
      if (rows.length === 0) return "Tidak ada produk dengan stok tipis.";
      return rows
        .map((p) => `• ${p.name} (SKU ${p.sku}): stok ${p.stock} ${p.unit} (min ${p.minStock})`)
        .join("\n");
    },
  });

  const dashboardSummary = new DynamicStructuredTool({
    name: "ringkasan_dashboard",
    description:
      "Menampilkan ringkasan operasional: total produk, jumlah PO aktif, transaksi masuk/keluar hari ini, jumlah stok tipis, dan transaksi terbaru.",
    schema: z.object({}),
    func: async (): Promise<string> => {
      const d = await backend.getDashboard();
      const recent = d.recentTransactions
        .slice(0, 5)
        .map(
          (t) =>
            `• ${TYPE_LABEL[t.type] ?? t.type} ${t.quantity} ${t.product.unit} ${t.product.name} (${t.warehouse.name})`,
        )
        .join("\n");
      return `Ringkasan hari ini:\n• Total produk: ${d.totalProducts}\n• PO aktif: ${d.activePOs}\n• Barang masuk hari ini: ${d.todayInbound}\n• Barang keluar hari ini: ${d.todayOutbound}\n• Produk stok tipis: ${d.lowStockCount}\nTransaksi terbaru:\n${recent}`;
    },
  });

  const periodSummary = new DynamicStructuredTool({
    name: "ringkasan_periode",
    description:
      "Menampilkan ringkasan/tren suatu PERIODE (rentang tanggal): total barang masuk & keluar (unit dan jumlah transaksi), partner pengiriman terbanyak, total produk, PO aktif, dan stok tipis. Gunakan untuk pertanyaan seperti 'pengiriman bulan lalu' atau 'kinerja minggu ini'. Kosongkan from/to untuk periode bulan berjalan sampai hari ini.",
    schema: periodSummarySchema,
    func: async (input: PeriodSummaryInput): Promise<string> => {
      const d = await backend.getPeriodSummary({ from: input.from, to: input.to });
      const partners = d.topPartners.length
        ? d.topPartners.map((p) => `  – ${p.partner}: ${p.quantity} unit`).join("\n")
        : "  – Belum ada pengiriman.";
      return [
        `Ringkasan periode ${d.from} s/d ${d.to}:`,
        `• Total produk: ${d.totalProducts}`,
        `• PO aktif: ${d.activePOs}`,
        `• Produk stok tipis: ${d.lowStockCount}`,
        `• Barang masuk: ${d.inbound.quantity} unit (${d.inbound.count} transaksi)`,
        `• Barang keluar: ${d.outbound.quantity} unit (${d.outbound.count} transaksi)`,
        "Pengiriman terbanyak:",
        partners,
      ].join("\n");
    },
  });

  return [
    checkStock,
    shipmentRecap,
    searchProduct,
    listCategories,
    listPartners,
    listWarehouses,
    stockPerWarehouse,
    listTransactions,
    listPos,
    listPosByStatus,
    detailPo,
    listDeliveryNotes,
    lowStock,
    dashboardSummary,
    periodSummary,
  ];
}
