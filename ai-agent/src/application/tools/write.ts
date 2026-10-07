import { DynamicStructuredTool } from "@langchain/core/tools";
import type { BackendGateway } from "../ports/backendGateway";
import { draftItemLines, formatIdDate } from "./format";
import { type DnDraftInput, type PoInput, dnDraftSchema, poSchema } from "./schemas";

export interface WriteToolDeps {
  backend: BackendGateway;
}

function backendErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message ?? "kesalahan sistem";
}

export function buildWriteTools({ backend }: WriteToolDeps, chatId: string) {
  const createPoDraft = new DynamicStructuredTool({
    name: "buat_draft_po",
    description:
      "Membuat draft Purchase Order (PO) baru. Status selalu DRAFT dan wajib dikonfirmasi admin di web. Gunakan nama produk persis seperti di katalog (lihat hasil cari_produk); nama bebas seperti 'cumi2 beku 1 kilo' bisa gagal dan mengembalikan kandidat/saran.",
    schema: poSchema,
    func: async (input: PoInput): Promise<string> => {
      try {
        const po = await backend.createPoDraft({
          partnerName: input.partnerName,
          items: input.items,
          targetDate: input.targetDate ?? undefined,
          source: "AI_CHAT",
          chatId,
        });
        const target = formatIdDate(po.targetDate);
        const lines = [
          `Draft PO ${po.poNumber} untuk ${po.partner.name} berhasil dibuat (status DRAFT).`,
          `• Supplier: ${po.partner.name}`,
          `• Target: ${target ?? "-"}`,
          ...draftItemLines(po.items),
          "Silakan konfirmasi di aplikasi web.",
        ];
        if (po.webUrl) lines.push(`Buka: ${po.webUrl}`);
        return lines.join("\n");
      } catch (e: unknown) {
        return `Gagal membuat PO: ${backendErrorMessage(e)}.`;
      }
    },
  });

  const createDnDraft = new DynamicStructuredTool({
    name: "buat_draft_surat_jalan",
    description:
      "Membuat draft Surat Jalan (Delivery Note) untuk partner CUSTOMER. Status selalu DRAFT; stok baru berkurang saat surat jalan dikirim (SHIPPED). Wajib dikonfirmasi/dikirim admin di web. Gunakan nama produk persis seperti di katalog (lihat hasil cari_produk); nama bebas seperti 'cumi2 beku 1 kilo' bisa gagal dan mengembalikan kandidat/saran.",
    schema: dnDraftSchema,
    func: async (input: DnDraftInput): Promise<string> => {
      try {
        const dn = await backend.createDnDraft({
          partnerName: input.partnerName,
          items: input.items,
          shipDate: input.shipDate ?? undefined,
          warehouseCode: input.warehouseCode ?? undefined,
          chatId,
        });
        const shipDate = formatIdDate(dn.shipDate);
        const lines = [
          `Draft Surat Jalan ${dn.dnNumber} untuk ${dn.partner.name} berhasil dibuat (status DRAFT).`,
          `• Customer: ${dn.partner.name}`,
          `• Tanggal kirim: ${shipDate ?? "-"}`,
          ...draftItemLines(dn.items),
          "Stok belum berkurang; silakan konfirmasi/kirim di aplikasi web.",
        ];
        return lines.join("\n");
      } catch (e: unknown) {
        return `Gagal membuat Surat Jalan: ${backendErrorMessage(e)}.`;
      }
    },
  });

  return [createPoDraft, createDnDraft];
}
