import type { Request, Response } from "express";
import { created, ok } from "../../presentation/http/respond";
import * as service from "./internal.service";

export async function aiLog(req: Request, res: Response) {
  created(res, await service.logConversation(req.body));
}

export async function chatUser(req: Request, res: Response) {
  ok(res, await service.requireChatUser(req.params.chatId));
}
