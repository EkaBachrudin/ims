import { buildMeta, parsePagination } from "../../lib/pagination";
import * as repo from "./audit-logs.repository";

export async function listAuditLogs(query: {
  page?: string;
  limit?: string;
  entity?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
}) {
  const { page, limit, skip, take } = parsePagination(query);
  const { rows, total } = await repo.listAuditLogs(
    {
      entity: query.entity,
      action: query.action,
      actorId: query.actorId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    },
    { skip, take },
  );

  return { rows, meta: buildMeta(page, limit, total) };
}
