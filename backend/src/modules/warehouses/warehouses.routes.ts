import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createWarehouseSchema,
  idParamSchema,
  listWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouses.schema";
import * as controller from "./warehouses.controller";

export const warehousesRouter = Router();
warehousesRouter.use(authenticate);

warehousesRouter.get("/", validate(listWarehouseSchema), asyncHandler(controller.list));

warehousesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createWarehouseSchema),
  asyncHandler(controller.create),
);

warehousesRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));

warehousesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateWarehouseSchema),
  asyncHandler(controller.update),
);

warehousesRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(controller.remove),
);
