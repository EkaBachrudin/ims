import { prismaAudit } from "../infrastructure/audit/prismaAudit";
import { telegramNotifier } from "../infrastructure/notifier/telegram";
import { prismaUnitOfWork } from "../infrastructure/prisma/unitOfWork";
import type { AuditPort } from "../application/ports/audit";
import type { NotifierPort } from "../application/ports/notifier";
import type { UnitOfWork } from "../application/ports/unitOfWork";

/**
 * Composition root sederhana: adapter default untuk port lintas-cutting.
 * Service yang sudah dimigrasikan akan menerima port ini (atau variannya) dari sini.
 */
export const container: { audit: AuditPort; notifier: NotifierPort; uow: UnitOfWork } = {
  audit: prismaAudit,
  notifier: telegramNotifier,
  uow: prismaUnitOfWork,
};
