import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { audit } from "../../utils/audit";
import { hashPassword } from "../../utils/password";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { toPublicUser } from "./users.mapper";
import type { z } from "zod";
import type { createUserSchema, listUsersSchema, updateUserSchema } from "./users.schema";

export async function listUsers(query: z.infer<typeof listUsersSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return { rows: rows.map(toPublicUser), meta: buildMeta(page, limit, total) };
}
export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Errors.notFound("User");
  return toPublicUser(user);
}

export async function createUser(
  input: z.infer<typeof createUserSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw Errors.conflict("Email sudah terdaftar");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      role: input.role,
      telegramId: input.telegramId ?? null,
      whatsappNumber: input.whatsappNumber ?? null,
    },
  });

  await audit(
    { actorId, action: "CREATE", entity: "User", entityId: user.id, after: toPublicUser(user), ipAddress: ip },
    prisma,
  );

  return toPublicUser(user);
}

export async function updateUser(
  id: string,
  input: z.infer<typeof updateUserSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("User");

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.telegramId !== undefined ? { telegramId: input.telegramId } : {}),
      ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    },
  });

  await audit(
    {
      actorId,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      before: toPublicUser(before),
      after: toPublicUser(user),
      ipAddress: ip,
    },
    prisma,
  );

  return toPublicUser(user);
}

export async function deactivateUser(id: string, actorId?: string | null, ip?: string | null) {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw Errors.notFound("User");

  const user = await prisma.user.update({ where: { id }, data: { isActive: false } });

  await audit(
    {
      actorId,
      action: "DELETE",
      entity: "User",
      entityId: id,
      before: toPublicUser(before),
      after: toPublicUser(user),
      ipAddress: ip,
    },
    prisma,
  );

  return toPublicUser(user);
}
