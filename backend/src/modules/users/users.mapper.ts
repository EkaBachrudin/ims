import type { User } from "@prisma/client";

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    telegramId: user.telegramId,
    whatsappNumber: user.whatsappNumber,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
