import { z } from "zod";

export const listDnSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(["DRAFT", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
    partnerId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

const dnItem = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

export const createDnSchema = z.object({
  body: z.object({
    poId: z.string().uuid().nullable().optional(),
    partnerId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    shipDate: z.string(),
    notes: z.string().trim().nullable().optional(),
    items: z.array(dnItem).min(1).optional(),
  }),
});

export const updateDnStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(["SHIPPED", "DELIVERED", "CANCELLED"]),
    notes: z.string().trim().optional(),
  }),
});

export const updateDnSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    partnerId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    shipDate: z.string().optional(),
    notes: z.string().trim().nullable().optional(),
    items: z.array(dnItem).min(1).optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

// Internal endpoint dipakai AI Agent (tool `buat_draft_surat_jalan`)
export const draftDnSchema = z.object({
  body: z.object({
    partnerName: z.string().trim().min(1),
    warehouseCode: z.string().trim().optional(),
    shipDate: z.string().trim().optional(),
    notes: z.string().trim().nullable().optional(),
    items: z
      .array(
        z.object({
          productName: z.string().trim().min(1),
          qty: z.coerce.number().int().positive(),
        }),
      )
      .min(1),
    chatId: z.string().trim().min(1),
  }),
});
