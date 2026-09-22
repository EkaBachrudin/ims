import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireInternalKey } from "../../middlewares/auth";
import { aiLogSchema, chatUserParamSchema } from "./internal.schema";
import * as service from "./internal.service";

export const internalRouter = Router();
internalRouter.use(requireInternalKey);

internalRouter.post(
  "/ai-log",
  validate(aiLogSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await service.logConversation(req.body) });
  }),
);

internalRouter.get(
  "/chat-user/:chatId",
  validate(chatUserParamSchema),
  asyncHandler(async (req, res) => {
    const user = await service.requireChatUser(req.params.chatId);
    res.json({ success: true, data: user });
  }),
);
