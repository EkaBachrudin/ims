import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticate, authenticateOrInternal } from "../../middlewares/auth";
import { productNameParamSchema, shipmentRecapSchema, stockReportSchema } from "./reports.schema";
import * as service from "./reports.service";

export const reportsRouter = Router();

// --- Konsumen ganda (web Bearer / AI internal key) ---
reportsRouter.get(
  "/shipments",
  authenticateOrInternal,
  validate(shipmentRecapSchema),
  asyncHandler(async (req, res) => {
    const date = (req.query as { date?: string }).date ?? "";
    res.json({ success: true, data: await service.shipmentRecap(date) });
  }),
);

reportsRouter.get(
  "/stock/:productName",
  authenticateOrInternal,
  validate(productNameParamSchema),
  asyncHandler(async (req, res) => {
    const product = await service.findStockByProductName(req.params.productName);
    res.json({ success: true, data: product });
  }),
);

// --- Web dashboard (Bearer) ---
reportsRouter.use(authenticate);

reportsRouter.get(
  "/stock",
  validate(stockReportSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.stockReport(req.query as never) });
  }),
);

reportsRouter.get(
  "/low-stock",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await service.lowStock() });
  }),
);

reportsRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await service.dashboard() });
  }),
);
