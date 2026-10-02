import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  createProductSchema,
  idParamSchema,
  listProductSchema,
  updateProductSchema,
} from "./products.schema";
import * as controller from "./products.controller";

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get("/", validate(listProductSchema), asyncHandler(controller.list));

productsRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createProductSchema),
  asyncHandler(controller.create),
);

productsRouter.get("/:id", validate(idParamSchema), asyncHandler(controller.detail));

productsRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateProductSchema),
  asyncHandler(controller.update),
);

productsRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(controller.remove),
);
