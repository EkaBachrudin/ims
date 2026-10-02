import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { requireInternalKey } from "../../middlewares/auth";
import { aiLogSchema, chatUserParamSchema } from "./internal.schema";
import * as controller from "./internal.controller";

export const internalRouter = Router();
internalRouter.use(requireInternalKey);

internalRouter.post("/ai-log", validate(aiLogSchema), asyncHandler(controller.aiLog));

internalRouter.get(
  "/chat-user/:chatId",
  validate(chatUserParamSchema),
  asyncHandler(controller.chatUser),
);
