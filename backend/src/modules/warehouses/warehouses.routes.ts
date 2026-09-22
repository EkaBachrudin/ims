import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { clientIp } from "../../utils/audit";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import {
  createWarehouseSchema,
  idParamSchema,
  listWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouses.schema";
import * as service from "./warehouses.service";

export const warehousesRouter = Router();
warehousesRouter.use(authenticate);

warehousesRouter.get(
  "/",
  validate(listWarehouseSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.listWarehouses(req.query as never) });
  }),
);

warehousesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createWarehouseSchema),
  asyncHandler(async (req, res) => {
    const data = await service.createWarehouse(req.body, req.user?.id, clientIp(req));
    res.status(201).json({ success: true, data });
  }),
);

warehousesRouter.get(
  "/:id",
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await prisma.warehouse.findUnique({ where: { id: req.params.id } });
    if (!data) throw Errors.notFound("Warehouse");
    res.json({ success: true, data });
  }),
);

warehousesRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updateWarehouseSchema),
  asyncHandler(async (req, res) => {
    const data = await service.updateWarehouse(req.params.id, req.body, req.user?.id, clientIp(req));
    res.json({ success: true, data });
  }),
);

warehousesRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deleteWarehouse(req.params.id, req.user?.id, clientIp(req));
    res.json({ success: true, data: { message: "Deleted" } });
  }),
);
