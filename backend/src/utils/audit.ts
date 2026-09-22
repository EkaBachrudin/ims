import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "VOID";

type AuditClient = PrismaClient | Prisma.TransactionClient;

export async function audit(
  params: {
    actorId?: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ipAddress?: string | null;
  },
  client: AuditClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      before: (params.before ?? null) as Prisma.InputJsonValue,
      after: (params.after ?? null) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress ?? null,
    },
  });
}

export function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? null;
}
