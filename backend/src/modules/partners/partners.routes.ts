import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createPartnerSchema,
  idParamSchema,
  listPartnerSchema,
  updatePartnerSchema,
} from "./partners.schema";
import * as controller from "./partners.controller";

export const partnersRouter = Router();
partnersRouter.use(authenticate);

partnersRouter.get("/", validate(listPartnerSchema), asyncHandler(controller.list));

partnersRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createPartnerSchema),
  asyncHandler(controller.create),
);

partnersRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));

partnersRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updatePartnerSchema),
  asyncHandler(controller.update),
);

partnersRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(controller.remove),
);
