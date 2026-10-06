import { z } from "zod";

export const stockSchema = z.object({
  productName: z.string().describe("Nama barang, mis. 'dimsum'"),
});
export type StockInput = z.infer<typeof stockSchema>;

export const shipmentSchema = z.object({
  date: z
    .string()
    .describe(
      "Tanggal format YYYY-MM-DD. Konversi tanggal relatif (kemarin, besok) ke format ini.",
    ),
});
export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const poSchema = z.object({
  partnerName: z.string().describe("Nama supplier, mis. 'CV Sumber Frozen'"),
  items: z
    .array(z.object({ productName: z.string(), qty: z.number().int().positive() }))
    .min(1)
    .describe("Daftar barang yang dipesan"),
  targetDate: z.string().optional().nullable().describe("Tanggal target format YYYY-MM-DD (opsional)"),
});
export type PoInput = z.infer<typeof poSchema>;

export const dnDraftSchema = z.object({
  partnerName: z.string().describe("Nama customer, mis. 'Agen Bahari'"),
  items: z
    .array(z.object({ productName: z.string(), qty: z.number().int().positive() }))
    .min(1)
    .describe("Daftar barang yang dikirim"),
  shipDate: z
    .string()
    .optional().nullable()
    .describe("Tanggal kirim format YYYY-MM-DD (opsional, default hari ini)"),
  warehouseCode: z.string().optional().nullable().describe("Kode/nama gudang asal (opsional)"),
});
export type DnDraftInput = z.infer<typeof dnDraftSchema>;

export const KNOWLEDGE_DOC_TYPES = [
  "sop",
  "faq",
  "kebijakan",
  "runbook",
  "panduan-produk",
  "onboarding",
  "catatan-partner",
  "kontrak",
  "kamus-produk",
  "laporan",
] as const;

export const sopSchema = z.object({
  query: z.string().describe("Pertanyaan/kata kunci pengguna"),
  docType: z
    .enum(KNOWLEDGE_DOC_TYPES)
    .optional()
    .nullable()
    .describe(
      "Jenis dokumen bila jelas: 'sop', 'faq', 'kebijakan', 'runbook', 'panduan-produk', 'onboarding', 'catatan-partner', 'kontrak'. Kosongkan bila tidak yakin.",
    ),
});
export type SopInput = z.infer<typeof sopSchema>;

export const kamusSchema = z.object({
  q: z
    .string()
    .describe("Nama produk informal/typo dari user, mis. 'cumi2 beku 1 kilo', 'bubur pedas'"),
});
export type KamusInput = z.infer<typeof kamusSchema>;

export const laporanSchema = z.object({
  query: z
    .string()
    .describe("Topik/periode laporan, mis. 'pengiriman bulan lalu', 'kinerja minggu ini'"),
});
export type LaporanInput = z.infer<typeof laporanSchema>;

export const productSearchSchema = z.object({
  q: z
    .string()
    .optional().nullable()
    .describe("Kata kunci nama/SKU produk (opsional). Kosongkan untuk semua produk."),
});
export type ProductSearchInput = z.infer<typeof productSearchSchema>;

export const partnerSearchSchema = z.object({
  q: z.string().optional().nullable().describe("Kata kunci nama partner (opsional)"),
  type: z.enum(["SUPPLIER", "CUSTOMER"]).optional().nullable().describe("Filter tipe partner (opsional)"),
});
export type PartnerSearchInput = z.infer<typeof partnerSearchSchema>;

export const inventorySchema = z.object({
  productName: z.string().optional().nullable().describe("Nama produk (opsional)"),
  warehouseCode: z.string().optional().nullable().describe("Kode atau nama gudang (opsional)"),
});
export type InventoryInput = z.infer<typeof inventorySchema>;

export const transactionSchema = z.object({
  direction: z
    .enum(["masuk", "keluar", "penyesuaian"])
    .optional().nullable()
    .describe(
      "Arah transaksi: 'masuk' (inbound), 'keluar' (outbound), 'penyesuaian'. Kosongkan untuk semua.",
    ),
  from: z.string().optional().nullable().describe("Tanggal awal format YYYY-MM-DD (opsional)"),
  to: z.string().optional().nullable().describe("Tanggal akhir format YYYY-MM-DD (opsional)"),
  productName: z.string().optional().nullable().describe("Nama produk (opsional)"),
  warehouseCode: z.string().optional().nullable().describe("Kode atau nama gudang (opsional)"),
  partnerName: z.string().optional().nullable().describe("Nama partner/supplier/customer (opsional)"),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const poListSchema = z.object({
  partnerName: z.string().optional().nullable().describe("Nama supplier (opsional)"),
  from: z
    .string()
    .optional().nullable()
    .describe("Tanggal awal dibuat format YYYY-MM-DD. Isi hanya bila user menyebut rentang tanggal."),
  to: z
    .string()
    .optional().nullable()
    .describe("Tanggal akhir dibuat format YYYY-MM-DD. Isi hanya bila user menyebut rentang tanggal."),
});
export type PoListInput = z.infer<typeof poListSchema>;

export const poStatusListSchema = z.object({
  statuses: z
    .array(z.enum(["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"]))
    .min(1)
    .describe(
      "Status PO yang disebut user secara eksplisit, mis. ['CONFIRMED'] atau ['COMPLETED','CANCELLED']. Wajib diisi.",
    ),
  partnerName: z.string().optional().nullable().describe("Nama supplier (opsional)"),
  from: z
    .string()
    .optional().nullable()
    .describe("Tanggal awal dibuat format YYYY-MM-DD. Isi hanya bila user menyebut rentang tanggal."),
  to: z
    .string()
    .optional().nullable()
    .describe("Tanggal akhir dibuat format YYYY-MM-DD. Isi hanya bila user menyebut rentang tanggal."),
});
export type PoStatusListInput = z.infer<typeof poStatusListSchema>;

export const poDetailSchema = z.object({
  poNumber: z.string().describe("Nomor PO, mis. 'PO-202609-001'"),
});
export type PoDetailInput = z.infer<typeof poDetailSchema>;

export const dnListSchema = z.object({
  status: z
    .enum(["DRAFT", "SHIPPED", "DELIVERED", "CANCELLED"])
    .optional().nullable()
    .describe("Filter status surat jalan (opsional)"),
  partnerName: z.string().optional().nullable().describe("Nama customer (opsional)"),
  from: z.string().optional().nullable().describe("Tanggal kirim awal format YYYY-MM-DD (opsional)"),
  to: z.string().optional().nullable().describe("Tanggal kirim akhir format YYYY-MM-DD (opsional)"),
});
export type DnListInput = z.infer<typeof dnListSchema>;
