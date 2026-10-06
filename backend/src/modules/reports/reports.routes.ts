import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middlewares/validate";
import { authenticateOrInternal } from "../../middlewares/auth";
import {
  categoryCatalogSchema,
  dnListReportSchema,
  inventoryReportSchema,
  partnerCatalogSchema,
  periodSummarySchema,
  poListReportSchema,
  poNumberParamSchema,
  productCatalogSchema,
  productNameParamSchema,
  shipmentRecapSchema,
  stockReportSchema,
  transactionListReportSchema,
  warehouseCatalogSchema,
} from "./reports.schema";
import * as controller from "./reports.controller";

export const reportsRouter = Router();

// --- Konsumen ganda (web Bearer / AI internal key) ---
reportsRouter.use(authenticateOrInternal);

reportsRouter.get("/shipments", validate(shipmentRecapSchema), asyncHandler(controller.shipments));

reportsRouter.get(
  "/stock/:productName",
  validate(productNameParamSchema),
  asyncHandler(controller.stockByName),
);

reportsRouter.get("/stock", validate(stockReportSchema), asyncHandler(controller.stock));

reportsRouter.get("/low-stock", asyncHandler(controller.lowStock));

reportsRouter.get("/dashboard", asyncHandler(controller.dashboard));

reportsRouter.get(
  "/period-summary",
  validate(periodSummarySchema),
  asyncHandler(controller.periodSummary),
);

// --- Endpoint baca untuk AI Agent (master data & transaksional) ---
reportsRouter.get("/products", validate(productCatalogSchema), asyncHandler(controller.products));

reportsRouter.get(
  "/categories",
  validate(categoryCatalogSchema),
  asyncHandler(controller.categories),
);

reportsRouter.get("/partners", validate(partnerCatalogSchema), asyncHandler(controller.partners));

reportsRouter.get(
  "/warehouses",
  validate(warehouseCatalogSchema),
  asyncHandler(controller.warehouses),
);

reportsRouter.get(
  "/inventory",
  validate(inventoryReportSchema),
  asyncHandler(controller.inventory),
);

reportsRouter.get(
  "/transactions",
  validate(transactionListReportSchema),
  asyncHandler(controller.transactions),
);

reportsRouter.get(
  "/purchase-orders",
  validate(poListReportSchema),
  asyncHandler(controller.purchaseOrders),
);

reportsRouter.get(
  "/purchase-orders/:poNumber",
  validate(poNumberParamSchema),
  asyncHandler(controller.purchaseOrderDetail),
);

reportsRouter.get(
  "/delivery-notes",
  validate(dnListReportSchema),
  asyncHandler(controller.deliveryNotes),
);
