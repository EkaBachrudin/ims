import { z } from "zod";

export const listWarehouseSchema = z.object({
  query: z.object({ q: z.string().trim().optional() }),
});

const warehouseBody = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  address: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createWarehouseSchema = z.object({ body: warehouseBody });
export const updateWarehouseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: warehouseBody.partial(),
});
export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
