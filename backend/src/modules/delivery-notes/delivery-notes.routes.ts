import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate, requireInternalKey } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createDnSchema,
  draftDnSchema,
  idParamSchema,
  listDnSchema,
  updateDnSchema,
  updateDnStatusSchema,
} from "./delivery-notes.schema";
import * as controller from "./delivery-notes.controller";

export const deliveryNotesRouter = Router();

// Internal endpoint untuk AI Agent (didaftarkan lebih dulu agar tidak tertutup auth Bearer).
deliveryNotesRouter.post(
  "/draft",
  requireInternalKey,
  validate(draftDnSchema),
  asyncHandler(controller.createDraft),
);

deliveryNotesRouter.use(authenticate);

deliveryNotesRouter.get("/", validate(listDnSchema), asyncHandler(controller.list));
deliveryNotesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createDnSchema),
  asyncHandler(controller.create),
);
deliveryNotesRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));
deliveryNotesRouter.put(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateDnSchema),
  asyncHandler(controller.update),
);
deliveryNotesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateDnStatusSchema),
  asyncHandler(controller.updateStatus),
);
