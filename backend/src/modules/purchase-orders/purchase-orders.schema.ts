import { z } from "zod";

const poStatus = z.enum(["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"]);

export const listPoSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: poStatus.optional(),
    partnerId: z.string().uuid().optional(),
    source: z.enum(["WEB", "AI_CHAT"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

const webItem = z.object({
  productId: z.string().uuid().optional(),
  productName: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative().nullable().optional(),
});

export const createPoSchema = z.object({
  body: z.object({
    partnerId: z.string().uuid(),
    warehouseId: z.string().uuid().nullable().optional(),
    targetDate: z.string().datetime().or(z.string().date()).nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    source: z.enum(["WEB", "AI_CHAT"]).default("WEB"),
    items: z.array(webItem).min(1),
  }),
});

export const updatePoSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    partnerId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().nullable().optional(),
    targetDate: z.string().datetime().or(z.string().date()).nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    items: z.array(webItem).min(1).optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

// Internal endpoint dipakai AI Agent (tool `buat_draft_po`)
export const draftPoSchema = z.object({
  body: z.object({
    partnerName: z.string().trim().min(1),
    warehouseCode: z.string().trim().optional(),
    targetDate: z.string().optional(),
    notes: z.string().trim().nullable().optional(),
    source: z.enum(["WEB", "AI_CHAT"]).default("AI_CHAT"),
    items: z
      .array(
        z.object({
          productName: z.string().trim().min(1),
          qty: z.coerce.number().int().positive(),
        }),
      )
      .min(1),
    chatId: z.string().trim().optional(),
  }),
});
