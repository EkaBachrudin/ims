import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import type { z } from "zod";
import type { aiLogSchema } from "./internal.schema";

export async function resolveChatUser(chatId: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ telegramId: chatId }, { whatsappNumber: chatId }] },
    select: { id: true, name: true, role: true, isActive: true },
  });
  return user;
}

export async function logConversation(input: z.infer<typeof aiLogSchema>["body"]) {
  const user = await resolveChatUser(input.chatId);

  const log = await prisma.aiConversationLog.create({
    data: {
      userId: user?.id ?? null,
      platform: input.platform,
      chatId: input.chatId,
      messageIn: input.messageIn,
      messageOut: input.messageOut ?? null,
      intent: input.intent ?? null,
      toolName: input.toolName ?? null,
      toolPayload: (input.toolPayload ?? null) as Prisma.InputJsonValue,
      toolResult: (input.toolResult ?? null) as Prisma.InputJsonValue,
      latencyMs: input.latencyMs ?? null,
    },
  });

  return {
    id: log.id,
    registered: Boolean(user && user.isActive),
    user: user ? { id: user.id, name: user.name, role: user.role } : null,
  };
}

export async function requireChatUser(chatId: string) {
  const user = await resolveChatUser(chatId);
  if (!user || !user.isActive) throw Errors.forbidden("Chat ID tidak terdaftar atau user non-aktif");
  return user;
}
