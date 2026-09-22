import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { clientIp } from "../../utils/audit";
import {
  createProductSchema,
  idParamSchema,
  listProductSchema,
  updateProductSchema,
} from "./products.schema";
import * as service from "./products.service";

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get(
  "/",
  validate(listProductSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.listProducts(req.query as never);
    res.json({ success: true, data: rows, meta });
  }),
);

productsRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const data = await service.createProduct(req.body, req.user?.id, clientIp(req));
    res.status(201).json({ success: true, data });
  }),
);

productsRouter.get(
  "/:id",
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getProduct(req.params.id) });
  }),
);

productsRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const data = await service.updateProduct(req.params.id, req.body, req.user?.id, clientIp(req));
    res.json({ success: true, data });
  }),
);

productsRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteProduct(req.params.id, req.user?.id, clientIp(req));
    res.json({ success: true, data: { message: "Deleted" } });
  }),
);
