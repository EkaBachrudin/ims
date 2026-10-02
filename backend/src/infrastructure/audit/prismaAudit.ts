import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../prisma/client";
import type { AuditParams, AuditPort } from "../../application/ports/audit";

export async function audit(params: AuditParams, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
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

export const prismaAudit: AuditPort = { record: audit };
