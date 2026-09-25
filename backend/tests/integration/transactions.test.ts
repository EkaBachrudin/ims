import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { loginAs, resetDb, seedBaseline, type Baseline } from "../helpers/db";

const app = createApp();
let base: Baseline;
let token: string;

beforeAll(async () => {
  await resetDb();
  base = await seedBaseline();
  token = (await loginAs("admin@test.id")).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function auth() {
  return { Authorization: `Bearer ${token}` };
}

describe("Stock transactions", () => {
  it("AC-04: inbound menambah Product.stock", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });

    const res = await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 50 });

    expect(res.status).toBe(201);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    expect(after.stock).toBe(before.stock + 50);
  });

  it("AC-05: outbound melebihi stok ditolak 409 INSUFFICIENT_STOCK", async () => {
    const res = await request(app)
      .post("/api/transactions/outbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 999999 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("outbound valid mengurangi stok", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });

    const res = await request(app)
      .post("/api/transactions/outbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 30 });

    expect(res.status).toBe(201);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    expect(after.stock).toBe(before.stock - 30);
  });

  it("menolak qty <= 0 (VL-02)", async () => {
    const res = await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it("void transaksi mengoreksi stok (soft reversal)", async () => {
    const inbound = await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 10 });

    const afterInbound = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });

    const res = await request(app)
      .post(`/api/transactions/${inbound.body.data.id}/void`)
      .set(auth())
      .send({ reason: "salah input" });

    expect(res.status).toBe(201);
    const afterVoid = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    expect(afterVoid.stock).toBe(afterInbound.stock - 10);
  });
});

describe("Filter transaksi (search & filter)", () => {
  const uniqueRef = "REF-OUT-UNIK-9001";

  beforeAll(async () => {
    await request(app)
      .post("/api/transactions/outbound")
      .set(auth())
      .send({
        productId: base.product.id,
        warehouseId: base.warehouse.id,
        partnerId: base.partner.id,
        quantity: 1,
        referenceNo: uniqueRef,
      });
  });

  it("q mencocokkan nomor referensi", async () => {
    const res = await request(app).get(`/api/transactions?type=OUT&q=${uniqueRef}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].referenceNo).toBe(uniqueRef);
    expect(res.body.data[0].product.name).toContain("Dimsum");
  });

  it("q mencocokkan nama produk (case-insensitive)", async () => {
    const res = await request(app).get("/api/transactions?type=OUT&q=dimsum").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    for (const row of res.body.data) {
      expect(row.product.name.toLowerCase()).toContain("dimsum");
    }
  });

  it("filter warehouseId hanya mengembalikan gudang terkait", async () => {
    const res = await request(app)
      .get(`/api/transactions?type=OUT&warehouseId=${base.warehouse.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    for (const row of res.body.data) {
      expect(row.warehouseId).toBe(base.warehouse.id);
    }
  });

  it("filter partnerId hanya mengembalikan partner terkait", async () => {
    const res = await request(app)
      .get(`/api/transactions?type=OUT&partnerId=${base.partner.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    for (const row of res.body.data) {
      expect(row.partnerId).toBe(base.partner.id);
    }
  });

  it("filter rentang tanggal from/to", async () => {
    const inRange = await request(app)
      .get(`/api/transactions?type=OUT&from=2000-01-01&to=2100-01-01`)
      .set(auth());
    expect(inRange.status).toBe(200);
    expect(inRange.body.meta.total).toBeGreaterThan(0);

    const future = await request(app)
      .get(`/api/transactions?type=OUT&from=2100-01-01`)
      .set(auth());
    expect(future.status).toBe(200);
    expect(future.body.meta.total).toBe(0);
  });

  it("menolak partnerId bukan uuid (400)", async () => {
    const res = await request(app).get("/api/transactions?partnerId=not-a-uuid").set(auth());
    expect(res.status).toBe(400);
  });
});

describe("PO receipt reconciliation (FR-04.3/FR-04.7)", () => {
  it("IN bertaut PO menambah stok dan menutup PO saat penuh", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(auth())
      .send({
        partnerId: base.supplier.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 12 }],
      });
    const poId = created.body.data.id;
    await request(app).post(`/api/po/${poId}/confirm`).set(auth());

    const res = await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({
        productId: base.product.id,
        warehouseId: base.warehouse.id,
        quantity: 12,
        purchaseOrderId: poId,
      });

    expect(res.status).toBe(201);
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe("COMPLETED");
  });

  it("penerimaan sebagian tetap CONFIRMED dan menampilkan sisa", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(auth())
      .send({
        partnerId: base.supplier.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 10 }],
      });
    const poId = created.body.data.id;
    await request(app).post(`/api/po/${poId}/confirm`).set(auth());

    await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 4, purchaseOrderId: poId });

    const detail = await request(app).get(`/api/po/${poId}`).set(auth());
    expect(detail.body.data.status).toBe("CONFIRMED");
    expect(detail.body.data.items[0].receivedQuantity).toBe(4);
    expect(detail.body.data.items[0].remainingQuantity).toBe(6);
  });

  it("menolak penerimaan melebihi sisa pesanan (422)", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(auth())
      .send({
        partnerId: base.supplier.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 5 }],
      });
    const poId = created.body.data.id;
    await request(app).post(`/api/po/${poId}/confirm`).set(auth());

    const res = await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 6, purchaseOrderId: poId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE");
  });

  it("void IN membuka kembali PO COMPLETED", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(auth())
      .send({
        partnerId: base.supplier.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 8 }],
      });
    const poId = created.body.data.id;
    await request(app).post(`/api/po/${poId}/confirm`).set(auth());

    const inbound = await request(app)
      .post("/api/transactions/inbound")
      .set(auth())
      .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 8, purchaseOrderId: poId });

    await request(app)
      .post(`/api/transactions/${inbound.body.data.id}/void`)
      .set(auth())
      .send({ reason: "salah input" });

    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe("CONFIRMED");
  });
});

describe("Reports (AC-06)", () => {
  it("lookup stok berdasarkan nama mengembalikan angka dari DB", async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    const res = await request(app)
      .get(`/api/reports/stock/${encodeURIComponent("Dimsum")}`)
      .set("x-internal-key", "test_internal_key");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.product.stock).toBe(product.stock);
  });

  it("dashboard menyertakan createdBy/product/warehouse pada transaksi terbaru (regresi)", async () => {
    const res = await request(app).get("/api/reports/dashboard").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.recentTransactions)).toBe(true);
    for (const txn of res.body.data.recentTransactions) {
      expect(txn.product?.name).toBeTruthy();
      expect(txn.warehouse?.name).toBeTruthy();
      expect(txn.createdBy?.name).toBeTruthy();
    }
  });
});
