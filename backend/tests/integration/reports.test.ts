import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { loginAs, resetDb, seedBaseline, type Baseline } from "../helpers/db";

const app = createApp();
let base: Baseline;
let token: string;
let poNumber: string;
let dnNumber: string;

const internal = { "x-internal-key": "test_internal_key" };
const bearer = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await resetDb();
  base = await seedBaseline();
  token = (await loginAs("admin@test.id")).accessToken;

  await request(app)
    .post("/api/transactions/inbound")
    .set(bearer())
    .send({ productId: base.product.id, warehouseId: base.warehouse.id, quantity: 15 });

  const created = await request(app)
    .post("/api/po")
    .set(bearer())
    .send({
      partnerId: base.supplier.id,
      warehouseId: base.warehouse.id,
      items: [{ productId: base.product.id, quantity: 20 }],
    });
  poNumber = created.body.data.poNumber;
  await request(app).post(`/api/po/${created.body.data.id}/confirm`).set(bearer());

  const dn = await request(app)
    .post("/api/delivery-notes")
    .set(bearer())
    .send({
      partnerId: base.partner.id,
      warehouseId: base.warehouse.id,
      shipDate: "2026-09-20",
      items: [{ productId: base.product.id, quantity: 2 }],
    });
  dnNumber = dn.body.data.dnNumber;

  // Data untuk regresi pencarian substring multi-produk (mis. "tepung").
  const tepungA = await prisma.product.create({
    data: {
      sku: "TPG-001",
      name: "Tepung Tapioka Test",
      unit: "sak",
      stock: 0,
      minStock: 0,
      categoryId: base.category.id,
    },
  });
  const tepungB = await prisma.product.create({
    data: {
      sku: "TPG-002",
      name: "Tepung Terigu Test",
      unit: "sak",
      stock: 0,
      minStock: 0,
      categoryId: base.category.id,
    },
  });
  await prisma.stockTransaction.createMany({
    data: [
      {
        type: "OUT",
        quantity: 5,
        productId: tepungA.id,
        warehouseId: base.warehouse.id,
        createdById: base.admin.id,
        createdAt: new Date("2026-09-05T10:00:00"),
      },
      {
        type: "OUT",
        quantity: 7,
        productId: tepungB.id,
        warehouseId: base.warehouse.id,
        createdById: base.admin.id,
        createdAt: new Date("2026-09-06T10:00:00"),
      },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Reports read endpoints (AI Agent)", () => {
  it("menerima internal key untuk katalog produk", async () => {
    const res = await request(app).get("/api/reports/products?q=Dimsum").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toContain("Dimsum");
    expect(res.body.data[0].sku).toBe("TST-001");
  });

  it("menampilkan kategori dengan jumlah produk", async () => {
    const res = await request(app).get("/api/reports/categories").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { name: string }) => c.name === "Frozen")).toBe(true);
  });

  it("memfilter partner berdasarkan tipe", async () => {
    const res = await request(app).get("/api/reports/partners?type=SUPPLIER").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p: { name: string }) => p.name === "CV Test Sumber")).toBe(true);
    expect(res.body.data.every((p: { type: string }) => p.type === "SUPPLIER")).toBe(true);
  });

  it("menampilkan gudang", async () => {
    const res = await request(app).get("/api/reports/warehouses").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data[0].code).toBe("GDG-T1");
  });

  it("menampilkan stok per gudang", async () => {
    const res = await request(app).get("/api/reports/inventory?productName=Dimsum").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data[0].warehouse).toBe("Gudang Test");
    expect(res.body.data[0].quantity).toBeGreaterThan(0);
  });

  it("mengembalikan status ambiguous beserta kandidat pada lookup stok (regresi)", async () => {
    const res = await request(app).get("/api/reports/stock/Tepung").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ambiguous");
    expect(res.body.data.product).toBeNull();
    expect(res.body.data.candidates.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.candidates[0]).toHaveProperty("stock");
    expect(res.body.data.candidates[0]).toHaveProperty("unit");
  });

  it("mengembalikan status none pada lookup stok yang tidak ada", async () => {
    const res = await request(app).get("/api/reports/stock/TidakAda").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("none");
    expect(res.body.data.product).toBeNull();
  });

  it("menampilkan transaksi IN (barang masuk)", async () => {
    const res = await request(app).get("/api/reports/transactions?type=IN").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((t: { type: string }) => t.type === "IN")).toBe(true);
  });

  it("melaporkan filter nama yang tidak ditemukan", async () => {
    const res = await request(app)
      .get("/api/reports/transactions?productName=TidakAda")
      .set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.unmatched).toContain('produk "TidakAda"');
  });

  it("mencocokkan semua produk untuk kata kunci sebagian (regresi)", async () => {
    const res = await request(app)
      .get("/api/reports/transactions?type=OUT&productName=Tepung")
      .set(internal);
    expect(res.status).toBe(200);
    const productNames = new Set(res.body.data.map((t: { product: string }) => t.product));
    expect(productNames.size).toBeGreaterThanOrEqual(2);
    expect(res.body.matched.products.length).toBeGreaterThanOrEqual(2);
    expect(res.body.matched.products).toEqual(
      expect.arrayContaining(["Tepung Tapioka Test", "Tepung Terigu Test"]),
    );
  });

  it("memfilter PO berdasarkan status", async () => {
    const res = await request(app)
      .get("/api/reports/purchase-orders?status=CONFIRMED")
      .set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.some((po: { poNumber: string }) => po.poNumber === poNumber)).toBe(true);
  });

  it("memfilter PO berdasarkan beberapa status sekaligus", async () => {
    const draft = await prisma.purchaseOrder.create({
      data: {
        poNumber: "PO-TEST-DRAFT",
        status: "DRAFT",
        partnerId: base.supplier.id,
        warehouseId: base.warehouse.id,
        createdById: base.admin.id,
        items: { create: [{ productId: base.product.id, quantity: 5 }] },
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        poNumber: "PO-TEST-CANCEL",
        status: "CANCELLED",
        partnerId: base.supplier.id,
        warehouseId: base.warehouse.id,
        createdById: base.admin.id,
        items: { create: [{ productId: base.product.id, quantity: 3 }] },
      },
    });

    const res = await request(app)
      .get("/api/reports/purchase-orders?statuses=DRAFT,CONFIRMED")
      .set(internal);
    expect(res.status).toBe(200);
    const numbers = res.body.data.map((po: { poNumber: string }) => po.poNumber);
    expect(numbers).toContain(draft.poNumber);
    expect(numbers).toContain(poNumber);
    expect(numbers).not.toContain("PO-TEST-CANCEL");
    expect(
      res.body.data.every((po: { status: string }) =>
        ["DRAFT", "CONFIRMED"].includes(po.status),
      ),
    ).toBe(true);
  });

  it("menampilkan detail PO berdasarkan nomor", async () => {
    const res = await request(app).get(`/api/reports/purchase-orders/${poNumber}`).set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.poNumber).toBe(poNumber);
    expect(res.body.data.items[0].ordered).toBe(20);
  });

  it("menampilkan surat jalan", async () => {
    const res = await request(app).get("/api/reports/delivery-notes").set(internal);
    expect(res.status).toBe(200);
    expect(res.body.data.some((dn: { dnNumber: string }) => dn.dnNumber === dnNumber)).toBe(true);
  });

  it("menampilkan stok tipis dan dashboard", async () => {
    const low = await request(app).get("/api/reports/low-stock").set(internal);
    const dash = await request(app).get("/api/reports/dashboard").set(internal);
    expect(low.status).toBe(200);
    expect(Array.isArray(low.body.data)).toBe(true);
    expect(dash.status).toBe(200);
    expect(dash.body.data.totalProducts).toBeGreaterThan(0);
  });

  it("tetap dapat diakses web via Bearer token", async () => {
    const res = await request(app).get("/api/reports/products").set(bearer());
    expect(res.status).toBe(200);
  });
});
