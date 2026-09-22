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

const stockSchema = z.object({
  productName: z.string().describe("Nama barang, mis. 'dimsum'"),
});
type StockInput = z.infer<typeof stockSchema>;

const shipmentSchema = z.object({
  date: z
    .string()
    .describe("Tanggal format YYYY-MM-DD. Konversi tanggal relatif (kemarin, besok) ke format ini."),
});
type ShipmentInput = z.infer<typeof shipmentSchema>;

const poSchema = z.object({
  partnerName: z.string().describe("Nama PT/Customer, mis. 'PT Maju Jaya'"),
  items: z
    .array(z.object({ productName: z.string(), qty: z.number().int().positive() }))
    .min(1)
    .describe("Daftar barang yang dipesan"),
  targetDate: z.string().optional().describe("Tanggal target format YYYY-MM-DD (opsional)"),
});
type PoInput = z.infer<typeof poSchema>;

const sopSchema = z.object({
  query: z.string().describe("Pertanyaan/kata kunci pengguna"),
});
type SopInput = z.infer<typeof sopSchema>;

export function buildTools(chatId: string) {
  const checkStock = new DynamicStructuredTool({
    name: "cek_stok_barang",
    description: "Gunakan untuk mengetahui sisa stok barang di gudang berdasarkan nama barang.",
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
      "Merekap pengiriman harian. Gunakan saat user menanyakan kirim ke mana pada tanggal tertentu.",
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

  const searchSop = new DynamicStructuredTool({
    name: "cari_sop",
    description:
      "Mencari SOP, kebijakan, atau panduan internal. Gunakan untuk pertanyaan prosedural yang bukan data stok/pengiriman.",
    schema: sopSchema,
    func: async (input: SopInput): Promise<string> => {
      const chunks = await searchKnowledge(input.query, env.AGENT_TOP_K);
      if (chunks.length === 0) return "Tidak ada SOP/panduan yang relevan di knowledge base.";
      return chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.content}`).join("\n\n");
    },
  });

  return [checkStock, shipmentRecap, createPoDraft, searchSop];
}

export type AgentTools = ReturnType<typeof buildTools>;
