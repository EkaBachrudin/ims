import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { created, ok } from "../../presentation/http/respond";
import * as service from "./warehouses.service";

export async function list(req: Request, res: Response) {
  ok(res, await service.listWarehouses(req.query as never));
}

export async function detail(req: Request, res: Response) {
  ok(res, await service.getWarehouse(req.params.id));
}

export async function create(req: Request, res: Response) {
  created(res, await service.createWarehouse(req.body, req.user?.id, clientIp(req)));
}

export async function update(req: Request, res: Response) {
  ok(res, await service.updateWarehouse(req.params.id, req.body, req.user?.id, clientIp(req)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteWarehouse(req.params.id, req.user?.id, clientIp(req));
  ok(res, { message: "Deleted" });
}
