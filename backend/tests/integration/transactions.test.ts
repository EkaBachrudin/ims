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

describe("Reports (AC-06)", () => {
  it("lookup stok berdasarkan nama mengembalikan angka dari DB", async () => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    const res = await request(app)
      .get(`/api/reports/stock/${encodeURIComponent("Dimsum")}`)
      .set("x-internal-key", "test_internal_key");

    expect(res.status).toBe(200);
    expect(res.body.data.stock).toBe(product.stock);
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
