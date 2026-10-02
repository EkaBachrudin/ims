import type { Request, Response } from "express";
import { okList } from "../../presentation/http/respond";
import * as service from "./audit-logs.service";

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listAuditLogs(req.query as never);
  okList(res, rows, meta);
}
