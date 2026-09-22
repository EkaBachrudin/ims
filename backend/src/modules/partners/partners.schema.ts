import { z } from "zod";

const partnerType = z.enum(["SUPPLIER", "CUSTOMER"]);

export const listPartnerSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    type: partnerType.optional(),
    q: z.string().trim().optional(),
  }),
});

const partnerBody = z.object({
  name: z.string().trim().min(1),
  type: partnerType,
  phone: z.string().trim().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  address: z.string().trim().nullable().optional(),
});

export const createPartnerSchema = z.object({ body: partnerBody });
export const updatePartnerSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: partnerBody.partial(),
});
export const idParamSchema = z.object({ params: z.object({ id: z.string().uuid() }) });
