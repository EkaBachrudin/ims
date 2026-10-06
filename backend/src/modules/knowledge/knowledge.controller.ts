import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { created, ok, okList } from "../../presentation/http/respond";
import * as service from "./knowledge.service";

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listDocuments(req.query as never);
  okList(res, rows, meta);
}

export async function detail(req: Request, res: Response) {
  ok(res, await service.getDocument(req.params.id));
}

export async function create(req: Request, res: Response) {
  const file = req.file
    ? { filename: req.file.originalname, content: req.file.buffer.toString("utf8") }
    : undefined;
  created(res, await service.createDocument(req.body, req.user?.id, clientIp(req), file));
}

export async function update(req: Request, res: Response) {
  ok(res, await service.updateDocument(req.params.id, req.body, req.user?.id, clientIp(req)));
}

export async function remove(req: Request, res: Response) {
  await service.deleteDocument(req.params.id, req.user?.id, clientIp(req));
  ok(res, { message: "Deleted" });
}

export async function stats(_req: Request, res: Response) {
  ok(res, await service.getStats());
}

export async function chunks(req: Request, res: Response) {
  const { rows, meta } = await service.listChunks(req.query as never);
  okList(res, rows, meta);
}

export async function ingest(req: Request, res: Response) {
  const body = (req.body ?? {}) as { documentId?: string; docType?: string };
  const state = await service.triggerIngest(body, req.user?.id, clientIp(req));
  res.status(202).json({ success: true, data: state });
}

export async function ingestStatus(_req: Request, res: Response) {
  ok(res, await service.getIngestStatus());
}
