import type { Request, Response } from "express";
import { clientIp } from "../../lib/http/clientIp";
import { Errors } from "../../lib/errors";
import { created, ok, okList } from "../../presentation/http/respond";
import * as usersService from "../users/users.service";
import * as service from "./delivery-notes.service";

function actorId(req: Request): string {
  if (!req.user) throw Errors.unauthenticated();
  return req.user.id;
}

export async function list(req: Request, res: Response) {
  const { rows, meta } = await service.listDns(req.query as never);
  okList(res, rows, meta);
}

export async function detail(req: Request, res: Response) {
  ok(res, await service.getDn(req.params.id));
}

export async function create(req: Request, res: Response) {
  created(res, await service.createDn(req.body, actorId(req), clientIp(req)));
}

export async function updateStatus(req: Request, res: Response) {
  ok(res, await service.updateDnStatus(req.params.id, req.body, req.user?.id, clientIp(req)));
}

export async function update(req: Request, res: Response) {
  ok(res, await service.updateDn(req.params.id, req.body, req.user?.id, clientIp(req)));
}

/** Internal: dipanggil AI Agent. Memetakan chatId → user aktif; status selalu DRAFT. */
export async function createDraft(req: Request, res: Response) {
  const chatId = (req.body as { chatId?: string }).chatId;
  if (!chatId) throw Errors.forbidden("chatId tidak dikirim");

  const user = await usersService.requireActiveByChatId(chatId);
  created(res, await service.createDraftFromChat(req.body, user.id, clientIp(req)));
}
