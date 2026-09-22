import { z } from "zod";

export const listTransactionSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    type: z.enum(["IN", "OUT", "ADJUSTMENT"]).optional(),
    productId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const recordTransactionSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
    notes: z.string().trim().nullable().optional(),
    referenceNo: z.string().trim().nullable().optional(),
    partnerId: z.string().uuid().nullable().optional(),
    purchaseOrderId: z.string().uuid().nullable().optional(),
    deliveryNoteId: z.string().uuid().nullable().optional(),
  }),
});

export const voidTransactionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(1) }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
