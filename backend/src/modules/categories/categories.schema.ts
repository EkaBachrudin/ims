import { z } from "zod";

export const listCategorySchema = z.object({
  query: z.object({ q: z.string().trim().optional() }),
});

export const createCategorySchema = z.object({
  body: z.object({ name: z.string().trim().min(1) }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ name: z.string().trim().min(1) }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
