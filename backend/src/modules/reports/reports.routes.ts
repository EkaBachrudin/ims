import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticateOrInternal } from "../../middlewares/auth";
import {
  categoryCatalogSchema,
  dnListReportSchema,
  inventoryReportSchema,
  partnerCatalogSchema,
  poListReportSchema,
  poNumberParamSchema,
  productCatalogSchema,
  productNameParamSchema,
  shipmentRecapSchema,
  stockReportSchema,
  transactionListReportSchema,
  warehouseCatalogSchema,
} from "./reports.schema";
import * as service from "./reports.service";

export const reportsRouter = Router();

// --- Konsumen ganda (web Bearer / AI internal key) ---
reportsRouter.use(authenticateOrInternal);

reportsRouter.get(
  "/shipments",
  validate(shipmentRecapSchema),
  asyncHandler(async (req, res) => {
    const date = (req.query as { date?: string }).date ?? "";
    res.json({ success: true, data: await service.shipmentRecap(date) });
  }),
);

reportsRouter.get(
  "/stock/:productName",
  validate(productNameParamSchema),
  asyncHandler(async (req, res) => {
    const product = await service.findStockByProductName(req.params.productName);
    res.json({ success: true, data: product });
  }),
);

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

// --- Endpoint baca untuk AI Agent (master data & transaksional) ---
reportsRouter.get(
  "/products",
  validate(productCatalogSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.productCatalog(req.query as never);
    res.json({ success: true, data: rows, meta });
  }),
);

reportsRouter.get(
  "/categories",
  validate(categoryCatalogSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.categoryCatalog(req.query as never) });
  }),
);

reportsRouter.get(
  "/partners",
  validate(partnerCatalogSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.partnerCatalog(req.query as never);
    res.json({ success: true, data: rows, meta });
  }),
);

reportsRouter.get(
  "/warehouses",
  validate(warehouseCatalogSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.warehouseCatalog(req.query as never) });
  }),
);

reportsRouter.get(
  "/inventory",
  validate(inventoryReportSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.inventoryReport(req.query as never);
    res.json({ success: true, data: rows, meta });
  }),
);

reportsRouter.get(
  "/transactions",
  validate(transactionListReportSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta, unmatched, matched } = await service.transactionListReport(
      req.query as never,
    );
    res.json({ success: true, data: rows, meta, unmatched, matched });
  }),
);

reportsRouter.get(
  "/purchase-orders",
  validate(poListReportSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta, unmatched, matched } = await service.purchaseOrderListReport(
      req.query as never,
    );
    res.json({ success: true, data: rows, meta, unmatched, matched });
  }),
);

reportsRouter.get(
  "/purchase-orders/:poNumber",
  validate(poNumberParamSchema),
  asyncHandler(async (req, res) => {
    const po = await service.purchaseOrderDetailReport(req.params.poNumber);
    res.json({ success: true, data: po });
  }),
);

reportsRouter.get(
  "/delivery-notes",
  validate(dnListReportSchema),
  asyncHandler(async (req, res) => {
    const { rows, meta, unmatched, matched } = await service.deliveryNoteListReport(
      req.query as never,
    );
    res.json({ success: true, data: rows, meta, unmatched, matched });
  }),
);
