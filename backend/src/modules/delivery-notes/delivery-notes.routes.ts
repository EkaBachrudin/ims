import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { createDnSchema, idParamSchema, listDnSchema, updateDnStatusSchema } from "./delivery-notes.schema";
import * as controller from "./delivery-notes.controller";

export const deliveryNotesRouter = Router();
deliveryNotesRouter.use(authenticate);

deliveryNotesRouter.get("/", validate(listDnSchema), asyncHandler(controller.list));
deliveryNotesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createDnSchema),
  asyncHandler(controller.create),
);
deliveryNotesRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));
deliveryNotesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateDnStatusSchema),
  asyncHandler(controller.updateStatus),
);
