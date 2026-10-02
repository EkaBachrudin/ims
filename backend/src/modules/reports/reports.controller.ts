import type { Request, Response } from "express";
import { ok, okList } from "../../presentation/http/respond";
import * as service from "./reports.service";

export async function shipments(req: Request, res: Response) {
  const date = (req.query as { date?: string }).date ?? "";
  ok(res, await service.shipmentRecap(date));
}

export async function stockByName(req: Request, res: Response) {
  ok(res, await service.findStockByProductName(req.params.productName));
}

export async function stock(req: Request, res: Response) {
  ok(res, await service.stockReport(req.query as never));
}

export async function lowStock(_req: Request, res: Response) {
  ok(res, await service.lowStock());
}

export async function dashboard(_req: Request, res: Response) {
  ok(res, await service.dashboard());
}

export async function products(req: Request, res: Response) {
  const { rows, meta } = await service.productCatalog(req.query as never);
  okList(res, rows, meta);
}

export async function categories(req: Request, res: Response) {
  ok(res, await service.categoryCatalog(req.query as never));
}

export async function partners(req: Request, res: Response) {
  const { rows, meta } = await service.partnerCatalog(req.query as never);
  okList(res, rows, meta);
}

export async function warehouses(req: Request, res: Response) {
  ok(res, await service.warehouseCatalog(req.query as never));
}

export async function inventory(req: Request, res: Response) {
  const { rows, meta } = await service.inventoryReport(req.query as never);
  okList(res, rows, meta);
}

export async function transactions(req: Request, res: Response) {
  const { rows, meta, unmatched, matched } = await service.transactionListReport(
    req.query as never,
  );
  res.json({ success: true, data: rows, meta, unmatched, matched });
}

export async function purchaseOrders(req: Request, res: Response) {
  const { rows, meta, unmatched, matched } = await service.purchaseOrderListReport(
    req.query as never,
  );
  res.json({ success: true, data: rows, meta, unmatched, matched });
}

export async function purchaseOrderDetail(req: Request, res: Response) {
  ok(res, await service.purchaseOrderDetailReport(req.params.poNumber));
}

export async function deliveryNotes(req: Request, res: Response) {
  const { rows, meta, unmatched, matched } = await service.deliveryNoteListReport(
    req.query as never,
  );
  res.json({ success: true, data: rows, meta, unmatched, matched });
}
