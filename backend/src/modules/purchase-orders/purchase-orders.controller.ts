import type { Request, Response } from "express";
import { clientIp } from "../../utils/audit";
import { Errors } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import * as service from "./purchase-orders.service";

function actorId(req: Request): string {
  if (!req.user) throw Errors.unauthenticated();
  return req.user.id;
}

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listPos(req.query as never);
  res.json({ success: true, data: rows, meta });
}

export async function detail(req: Request, res: Response) {
  res.json({ success: true, data: await service.getPo(req.params.id) });
}

export async function create(req: Request, res: Response) {
  const data = await service.createPo(req.body, actorId(req), clientIp(req));
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const data = await service.updatePo(req.params.id, req.body, req.user?.id, clientIp(req));
  res.json({ success: true, data });
}

export async function confirm(req: Request, res: Response) {
  res.json({ success: true, data: await service.confirmPo(req.params.id, req.user?.id, clientIp(req)) });
}

export async function complete(req: Request, res: Response) {
  res.json({ success: true, data: await service.completePo(req.params.id, req.user?.id, clientIp(req)) });
}

export async function cancel(req: Request, res: Response) {
  res.json({ success: true, data: await service.cancelPo(req.params.id, req.user?.id, clientIp(req)) });
}

export async function remove(req: Request, res: Response) {
  await service.deletePo(req.params.id, req.user?.id, clientIp(req));
  res.json({ success: true, data: { message: "Deleted" } });
}

/** Internal: dipanggil AI Agent. Memetakan chatId → user aktif; status selalu DRAFT. */
export async function createDraft(req: Request, res: Response) {
  const body = req.body as { chatId?: string };
  const chatId = body.chatId;
  if (!chatId) throw Errors.forbidden("chatId tidak dikirim");

  const user = await prisma.user.findFirst({
    where: { OR: [{ telegramId: chatId }, { whatsappNumber: chatId }] },
  });
  if (!user || !user.isActive) throw Errors.forbidden("Chat ID tidak terdaftar atau user non-aktif");

  const data = await service.createDraftFromChat(req.body, user.id, clientIp(req));
  res.status(201).json({ success: true, data });
}
