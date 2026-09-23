import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate, requireInternalKey } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createPoSchema,
  draftPoSchema,
  idParamSchema,
  listPoSchema,
  updatePoSchema,
} from "./purchase-orders.schema";
import * as controller from "./purchase-orders.controller";

export const purchaseOrdersRouter = Router();

// Internal endpoint untuk AI Agent (didaftarkan lebih dulu agar tidak tertutup auth Bearer).
purchaseOrdersRouter.post(
  "/draft",
  requireInternalKey,
  validate(draftPoSchema),
  asyncHandler(controller.createDraft),
);

purchaseOrdersRouter.use(authenticate);

purchaseOrdersRouter.get("/", requireRole("SUPER_ADMIN", "ADMIN", "OWNER"), validate(listPoSchema), asyncHandler(controller.list));
purchaseOrdersRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "OWNER"),
  validate(createPoSchema),
  asyncHandler(controller.create),
);
purchaseOrdersRouter.get("/:id", requireRole("SUPER_ADMIN", "ADMIN", "OWNER"), validate(idParamSchema), asyncHandler(controller.detail));
purchaseOrdersRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN", "OWNER"),
  validate(updatePoSchema),
  asyncHandler(controller.update),
);

// Aksi lifecycle hanya untuk Admin/Super Admin (Owner hanya draft via chat/web).
const adminOnly = requireRole("SUPER_ADMIN", "ADMIN");
purchaseOrdersRouter.post("/:id/confirm", adminOnly, validate(idParamSchema), asyncHandler(controller.confirm));
purchaseOrdersRouter.post("/:id/cancel", adminOnly, validate(idParamSchema), asyncHandler(controller.cancel));
purchaseOrdersRouter.delete("/:id", adminOnly, validate(idParamSchema), asyncHandler(controller.remove));
