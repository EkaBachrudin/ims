import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { Errors } from "../../lib/errors";
import { created, okList } from "../../presentation/http/respond";
import * as service from "./transactions.service";

function requireUserId(req: Request): string {
  if (!req.user) throw Errors.unauthenticated();
  return req.user.id;
}

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listTransactions(req.query as never);
  okList(res, rows, meta);
}

export async function inbound(req: Request, res: Response) {
  const data = await service.recordTransaction(
    "IN",
    { ...req.body, createdById: requireUserId(req) },
    req.user?.id,
    clientIp(req),
  );
  created(res, data);
}

export async function outbound(req: Request, res: Response) {
  const data = await service.recordTransaction(
    "OUT",
    { ...req.body, createdById: requireUserId(req) },
    req.user?.id,
    clientIp(req),
  );
  created(res, data);
}

export async function voidTxn(req: Request, res: Response) {
  const data = await service.voidTransaction(
    req.params.id,
    req.body.reason,
    req.user?.id,
    clientIp(req),
  );
  created(res, data);
}
