import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { Prisma, UserRole } from "@prisma/client";

interface ListUsersParams {
  role?: UserRole;
  q?: string;
  skip: number;
  take: number;
}

function buildWhere(params: { role?: UserRole; q?: string }): Prisma.UserWhereInput {
  return {
    ...(params.role ? { role: params.role } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { email: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listUsers(params: ListUsersParams, db: Db = prisma) {
  const where = buildWhere(params);
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: params.skip, take: params.take }),
    db.user.count({ where }),
  ]);
  return { rows, total };
}

export function findById(id: string, db: Db = prisma) {
  return db.user.findUnique({ where: { id } });
}

export function findByEmail(email: string, db: Db = prisma) {
  return db.user.findUnique({ where: { email } });
}

export function findByChatId(chatId: string, db: Db = prisma) {
  return db.user.findFirst({
    where: { OR: [{ telegramId: chatId }, { whatsappNumber: chatId }] },
  });
}

export function findAdminsWithTelegram(db: Db = prisma) {
  return db.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true, telegramId: { not: null } },
    select: { telegramId: true },
  });
}

export function create(data: Prisma.UserCreateInput, db: Db = prisma) {
  return db.user.create({ data });
}

export function update(id: string, data: Prisma.UserUpdateInput, db: Db = prisma) {
  return db.user.update({ where: { id }, data });
}
