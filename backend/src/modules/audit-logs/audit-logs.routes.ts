import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { prisma } from "../../lib/prisma";
import { buildMeta, parsePagination } from "../../utils/pagination";
import { listAuditSchema } from "./audit-logs.schema";

export const auditLogsRouter = Router();
auditLogsRouter.use(authenticate, requireRole("SUPER_ADMIN"));

auditLogsRouter.get(
  "/",
  validate(listAuditSchema),
  asyncHandler(async (req, res) => {
    const query = req.query as {
      page?: string;
      limit?: string;
      entity?: string;
      action?: string;
      actorId?: string;
      from?: string;
      to?: string;
    };
    const { page, limit, skip, take } = parsePagination(query);

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = new Date(query.to);

    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { actor: { select: { id: true, name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: rows, meta: buildMeta(page, limit, total) });
  }),
);
