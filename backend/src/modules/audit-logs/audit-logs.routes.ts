import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import { listAuditSchema } from "./audit-logs.schema";
import * as controller from "./audit-logs.controller";

export const auditLogsRouter = Router();
auditLogsRouter.use(authenticate, requireRole("SUPER_ADMIN"));

auditLogsRouter.get("/", validate(listAuditSchema), asyncHandler(controller.list));
