import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { clientIp } from "../../utils/audit";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import {
  createCategorySchema,
  idParamSchema,
  listCategorySchema,
  updateCategorySchema,
} from "./categories.schema";
import * as service from "./categories.service";

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

categoriesRouter.get(
  "/",
  validate(listCategorySchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.listCategories(req.query as never) });
  }),
);

categoriesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const data = await service.createCategory(req.body, req.user?.id, clientIp(req));
    res.status(201).json({ success: true, data });
  }),
);

categoriesRouter.get(
  "/:id",
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await prisma.category.findUnique({ where: { id: Number(req.params.id) } });
    if (!data) throw Errors.notFound("Category");
    res.json({ success: true, data });
  }),
);

categoriesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const data = await service.updateCategory(Number(req.params.id), req.body, req.user?.id, clientIp(req));
    res.json({ success: true, data });
  }),
);

categoriesRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteCategory(Number(req.params.id), req.user?.id, clientIp(req));
    res.json({ success: true, data: { message: "Deleted" } });
  }),
);
