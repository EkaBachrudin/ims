import type { Request, Response } from "express";
import { clientIp } from "../../utils/audit";
import * as service from "./users.service";

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listUsers(req.query as never);
  res.json({ success: true, data: rows, meta });
}

export async function detail(req: Request, res: Response) {
  const data = await service.getUser(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await service.createUser(req.body, req.user?.id, clientIp(req));
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const data = await service.updateUser(req.params.id, req.body, req.user?.id, clientIp(req));
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response) {
  const data = await service.deactivateUser(req.params.id, req.user?.id, clientIp(req));
  res.json({ success: true, data });
}
