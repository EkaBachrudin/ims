import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { clientIp } from "../../utils/audit";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import {
  createPartnerSchema,
  idParamSchema,
  listPartnerSchema,
  updatePartnerSchema,
} from "./partners.schema";
import * as service from "./partners.service";

export const partnersRouter = Router();
partnersRouter.use(authenticate);

partnersRouter.get(
  "/",
  validate(listPartnerSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.listPartners(req.query as never);
    res.json({ success: true, data: rows, meta });
  }),
);

partnersRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(createPartnerSchema),
  asyncHandler(async (req, res) => {
    const data = await service.createPartner(req.body, req.user?.id, clientIp(req));
    res.status(201).json({ success: true, data });
  }),
);

partnersRouter.get(
  "/:id",
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await prisma.partner.findUnique({ where: { id: req.params.id } });
    if (!data) throw Errors.notFound("Partner");
    res.json({ success: true, data });
  }),
);

partnersRouter.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(updatePartnerSchema),
  asyncHandler(async (req, res) => {
    const data = await service.updatePartner(req.params.id, req.body, req.user?.id, clientIp(req));
    res.json({ success: true, data });
  }),
);

partnersRouter.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await service.deletePartner(req.params.id, req.user?.id, clientIp(req));
    res.json({ success: true, data: { message: "Deleted" } });
  }),
);
