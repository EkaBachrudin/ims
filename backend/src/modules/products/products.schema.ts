import { z } from "zod";

export const listProductSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    q: z.string().trim().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    lowStock: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
  }),
});

const productBody = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  unit: z.string().trim().min(1),
  minStock: z.coerce.number().int().min(0).optional(),
  categoryId: z.coerce.number().int().positive(),
});

export const createProductSchema = z.object({ body: productBody });

// stock sengaja tidak disertakan: perubahan stok hanya via transaksi (VL-06 / BR-RULE-001)
export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: productBody.partial(),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
