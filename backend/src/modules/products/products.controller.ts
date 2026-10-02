import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { created, ok, okList } from "../../presentation/http/respond";
import * as service from "./products.service";

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listProducts(req.query as never);
  okList(res, rows, meta);
}

export async function detail(req: Request, res: Response) {
  ok(res, await service.getProduct(req.params.id));
}

export async function create(req: Request, res: Response) {
  created(res, await service.createProduct(req.body, req.user?.id, clientIp(req)));
}

export async function update(req: Request, res: Response) {
  ok(res, await service.updateProduct(req.params.id, req.body, req.user?.id, clientIp(req)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteProduct(req.params.id, req.user?.id, clientIp(req));
  ok(res, { message: "Deleted" });
}
