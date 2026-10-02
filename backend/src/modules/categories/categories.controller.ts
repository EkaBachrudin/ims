import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { created, ok } from "../../presentation/http/respond";
import * as service from "./categories.service";

export async function list(req: Request, res: Response) {
  const data = await service.listCategories(req.query as never);
  ok(res, data);
}

export async function detail(req: Request, res: Response) {
  const data = await service.getCategory(Number(req.params.id));
  ok(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.createCategory(req.body, req.user?.id, clientIp(req));
  created(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await service.updateCategory(Number(req.params.id), req.body, req.user?.id, clientIp(req));
  ok(res, data);
}

export async function remove(req: Request, res: Response) {
  await service.deleteCategory(Number(req.params.id), req.user?.id, clientIp(req));
  ok(res, { message: "Deleted" });
}
