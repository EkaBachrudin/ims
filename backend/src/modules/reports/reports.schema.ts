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

// --- Endpoint baca untuk AI Agent (konsumen ganda web + internal key) ---

export const productCatalogSchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const categoryCatalogSchema = z.object({
  query: z.object({ q: z.string().trim().optional() }),
});

export const partnerCatalogSchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    type: z.enum(["SUPPLIER", "CUSTOMER"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const warehouseCatalogSchema = z.object({
  query: z.object({ q: z.string().trim().optional() }),
});

export const inventoryReportSchema = z.object({
  query: z.object({
    productName: z.string().trim().optional(),
    warehouseCode: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const transactionListReportSchema = z.object({
  query: z.object({
    type: z.enum(["IN", "OUT", "ADJUSTMENT"]).optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    productName: z.string().trim().optional(),
    warehouseCode: z.string().trim().optional(),
    partnerName: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const poListReportSchema = z.object({
  query: z.object({
    status: z.enum(["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
    partnerName: z.string().trim().optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const poNumberParamSchema = z.object({
  params: z.object({ poNumber: z.string().trim().min(1) }),
});

export const dnListReportSchema = z.object({
  query: z.object({
    status: z.enum(["DRAFT", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
    partnerName: z.string().trim().optional(),
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
