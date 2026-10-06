import { z } from "zod";

export const DOC_TYPES = [
  "sop",
  "faq",
  "kebijakan",
  "runbook",
  "panduan-produk",
  "onboarding",
  "catatan-partner",
  "kontrak",
  "kamus-produk",
  "laporan",
] as const;

export const docTypeSchema = z.enum(DOC_TYPES);

export const listDocumentSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    docType: docTypeSchema.optional(),
    q: z.string().trim().optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  }),
});

export const createDocumentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1),
    docType: docTypeSchema.default("sop"),
    content: z.string().min(1).optional(),
    filename: z.string().trim().min(1).optional(),
    metadata: z.unknown().optional(),
  }),
});

export const updateDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(1).optional(),
    docType: docTypeSchema.optional(),
    content: z.string().min(1).optional(),
    filename: z.string().trim().min(1).optional(),
    metadata: z.unknown().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const listChunkSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    docType: docTypeSchema.optional(),
    q: z.string().trim().optional(),
  }),
});

export const ingestSchema = z.object({
  body: z
    .object({
      documentId: z.string().uuid().optional(),
      docType: docTypeSchema.optional(),
    })
    .optional(),
});
