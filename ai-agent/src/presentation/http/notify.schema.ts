import { z } from "zod";

/** Validasi body `POST /notify` dari backend (inbound). */
export const notifySchema = z.object({
  chatIds: z.array(z.string().trim().min(1)).min(1),
  text: z.string().trim().min(1),
  button: z
    .object({
      label: z.string().trim().min(1),
      url: z.string().url(),
    })
    .optional(),
});
