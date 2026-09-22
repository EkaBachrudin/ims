import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { createUserSchema, idParamSchema, listUsersSchema, updateUserSchema } from "./users.schema";
import * as controller from "./users.controller";

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole("SUPER_ADMIN"));

usersRouter.get("/", validate(listUsersSchema), asyncHandler(controller.list));
usersRouter.post("/", validate(createUserSchema), asyncHandler(controller.create));
usersRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));
usersRouter.patch("/:id", validate(updateUserSchema), asyncHandler(controller.update));
usersRouter.delete("/:id", validate(idParamSchema), asyncHandler(controller.remove));
