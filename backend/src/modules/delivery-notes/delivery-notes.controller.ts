import type { Request, Response } from "express";
import { clientIp } from "../../utils/audit";
import { Errors } from "../../lib/errors";
import * as service from "./delivery-notes.service";

function actorId(req: Request): string {
  if (!req.user) throw Errors.unauthenticated();
  return req.user.id;
}

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listDns(req.query as never);
  res.json({ success: true, data: rows, meta });
}

export async function detail(req: Request, res: Response) {
  res.json({ success: true, data: await service.getDn(req.params.id) });
}

export async function create(req: Request, res: Response) {
  const data = await service.createDn(req.body, actorId(req), clientIp(req));
  res.status(201).json({ success: true, data });
}

export async function updateStatus(req: Request, res: Response) {
  const data = await service.updateDnStatus(req.params.id, req.body, req.user?.id, clientIp(req));
  res.json({ success: true, data });
}
