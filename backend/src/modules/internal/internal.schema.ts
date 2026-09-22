import { z } from "zod";

export const aiLogSchema = z.object({
  body: z.object({
    platform: z.enum(["TELEGRAM", "WHATSAPP"]),
    chatId: z.string().trim().min(1),
    messageIn: z.string(),
    messageOut: z.string().nullable().optional(),
    intent: z.string().nullable().optional(),
    toolName: z.string().nullable().optional(),
    toolPayload: z.unknown().optional(),
    toolResult: z.unknown().optional(),
    latencyMs: z.coerce.number().int().nonnegative().optional(),
  }),
});

export const chatUserParamSchema = z.object({
  params: z.object({ chatId: z.string().trim().min(1) }),
});
