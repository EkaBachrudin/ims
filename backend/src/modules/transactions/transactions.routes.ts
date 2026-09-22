import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/rbac";
import {
  listTransactionSchema,
  recordTransactionSchema,
  voidTransactionSchema,
} from "./transactions.schema";
import * as controller from "./transactions.controller";

export const transactionsRouter = Router();
transactionsRouter.use(authenticate);

transactionsRouter.get("/", validate(listTransactionSchema), asyncHandler(controller.list));

transactionsRouter.post(
  "/inbound",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(recordTransactionSchema),
  asyncHandler(controller.inbound),
);

transactionsRouter.post(
  "/outbound",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(recordTransactionSchema),
  asyncHandler(controller.outbound),
);

transactionsRouter.post(
  "/:id/void",
  requireRole("SUPER_ADMIN", "ADMIN"),
  validate(voidTransactionSchema),
  asyncHandler(controller.voidTxn),
);
