import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createCategorySchema,
  idParamSchema,
  listCategorySchema,
  updateCategorySchema,
} from "./categories.schema";
import * as controller from "./categories.controller";

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

categoriesRouter.get("/", validate(listCategorySchema), asyncHandler(controller.list));

categoriesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createCategorySchema),
  asyncHandler(controller.create),
);

categoriesRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));

categoriesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateCategorySchema),
  asyncHandler(controller.update),
);

categoriesRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(controller.remove),
);
