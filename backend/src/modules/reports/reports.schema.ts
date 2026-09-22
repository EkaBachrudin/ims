import { z } from "zod";

export const stockReportSchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    warehouseId: z.string().uuid().optional(),
  }),
});

export const shipmentRecapSchema = z.object({
  query: z.object({ date: z.string().trim().optional() }),
});

export const productNameParamSchema = z.object({
  params: z.object({ productName: z.string().trim().min(1) }),
});
