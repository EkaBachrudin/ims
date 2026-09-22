import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { loginSchema, refreshSchema } from "./auth.schema";
import * as controller from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", validate(loginSchema), asyncHandler(controller.login));
authRouter.post("/refresh", validate(refreshSchema), asyncHandler(controller.refresh));
authRouter.post("/logout", validate(refreshSchema), asyncHandler(controller.logout));
authRouter.get("/me", authenticate, asyncHandler(controller.me));
