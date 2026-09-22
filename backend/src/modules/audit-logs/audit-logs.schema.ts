import { z } from "zod";

export const listAuditSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    entity: z.string().trim().optional(),
    action: z.string().trim().optional(),
    actorId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});
