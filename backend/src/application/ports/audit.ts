import type { Db } from "../../infrastructure/prisma/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "VOID" | "INGEST";

export interface AuditParams {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

/** Port pencatatan audit trail. Adapter default menulis ke Prisma. */
export interface AuditPort {
  record(params: AuditParams, db?: Db): Promise<void>;
}
