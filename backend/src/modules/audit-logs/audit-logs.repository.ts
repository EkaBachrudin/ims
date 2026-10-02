import { prisma, type Db } from "../../infrastructure/prisma/client";
import type { Prisma } from "@prisma/client";

export interface ListAuditLogsFilter {
  entity?: string;
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(
  filter: ListAuditLogsFilter,
  pagination: { skip: number; take: number },
  db: Db = prisma,
) {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;

  const where: Prisma.AuditLogWhereInput = {
    ...(filter.entity ? { entity: filter.entity } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      include: { actor: { select: { id: true, name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);

  return { rows, total };
}
