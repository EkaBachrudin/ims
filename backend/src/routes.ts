import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { productsRouter } from "./modules/products/products.routes";
import { partnersRouter } from "./modules/partners/partners.routes";
import { warehousesRouter } from "./modules/warehouses/warehouses.routes";
import { transactionsRouter } from "./modules/transactions/transactions.routes";
import { purchaseOrdersRouter } from "./modules/purchase-orders/purchase-orders.routes";
import { deliveryNotesRouter } from "./modules/delivery-notes/delivery-notes.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { internalRouter } from "./modules/internal/internal.routes";
import { auditLogsRouter } from "./modules/audit-logs/audit-logs.routes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", time: new Date().toISOString() } });
});

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/partners", partnersRouter);
router.use("/warehouses", warehousesRouter);
router.use("/transactions", transactionsRouter);
router.use("/po", purchaseOrdersRouter);
router.use("/delivery-notes", deliveryNotesRouter);
router.use("/reports", reportsRouter);
router.use("/audit-logs", auditLogsRouter);
router.use("/internal", internalRouter);
