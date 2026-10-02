import { Errors } from "../../lib/errors";
import { container } from "../../composition/container";
import { hashPassword } from "../../lib/password";
import { buildMeta, parsePagination } from "../../lib/pagination";
import { toPublicUser } from "./users.mapper";
import * as repo from "./users.repository";
import type { z } from "zod";
import type { createUserSchema, listUsersSchema, updateUserSchema } from "./users.schema";

export async function listUsers(query: z.infer<typeof listUsersSchema>["query"]) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listUsers({ role: query.role, q: query.q, skip, take });

  return { rows: rows.map(toPublicUser), meta: buildMeta(page, limit, total) };
}

export async function getUser(id: string) {
  const user = await repo.findById(id);
  if (!user) throw Errors.notFound("User");
  return toPublicUser(user);
}

/** Resolve user aktif dari chatId (Telegram/WhatsApp) — dipakai endpoint internal AI. */
export async function requireActiveByChatId(chatId: string) {
  const user = await repo.findByChatId(chatId);
  if (!user || !user.isActive) {
    throw Errors.forbidden("Chat ID tidak terdaftar atau user non-aktif");
  }
  return user;
}

export async function createUser(
  input: z.infer<typeof createUserSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const exists = await repo.findByEmail(input.email);
  if (exists) throw Errors.conflict("Email sudah terdaftar");

  const user = await repo.create({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    name: input.name,
    role: input.role,
    telegramId: input.telegramId ?? null,
    whatsappNumber: input.whatsappNumber ?? null,
  });

  await container.audit.record(
    { actorId, action: "CREATE", entity: "User", entityId: user.id, after: toPublicUser(user), ipAddress: ip },
  );

  return toPublicUser(user);
}

export async function updateUser(
  id: string,
  input: z.infer<typeof updateUserSchema>["body"],
  actorId?: string | null,
  ip?: string | null,
) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("User");

  const user = await repo.update(id, {
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.telegramId !== undefined ? { telegramId: input.telegramId } : {}),
    ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
  });

  await container.audit.record(
    {
      actorId,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      before: toPublicUser(before),
      after: toPublicUser(user),
      ipAddress: ip,
    },
  );

  return toPublicUser(user);
}

export async function deactivateUser(id: string, actorId?: string | null, ip?: string | null) {
  const before = await repo.findById(id);
  if (!before) throw Errors.notFound("User");

  const user = await repo.update(id, { isActive: false });

  await container.audit.record(
    {
      actorId,
      action: "DELETE",
      entity: "User",
      entityId: id,
      before: toPublicUser(before),
      after: toPublicUser(user),
      ipAddress: ip,
    },
  );

  return toPublicUser(user);
}
