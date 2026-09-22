import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { loginAs, resetDb, seedBaseline, type Baseline } from "../helpers/db";

const app = createApp();
const INTERNAL_KEY = "test_internal_key";

let base: Baseline;
let adminToken: string;
let superToken: string;

beforeAll(async () => {
  await resetDb();
  base = await seedBaseline();
  adminToken = (await loginAs("admin@test.id")).accessToken;
  superToken = (await loginAs("super@test.id")).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function admin() {
  return { Authorization: `Bearer ${adminToken}` };
}

describe("Purchase Order lifecycle (AC-07..AC-12)", () => {
  it("membuat PO dengan nomor otomatis dan status DRAFT (FR-06.2/06.3)", async () => {
    const res = await request(app)
      .post("/api/po")
      .set(admin())
      .send({
        partnerId: base.partner.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 10 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.poNumber).toMatch(/^PO-\d{6}-\d{3}$/);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("AC-09: konfirmasi PO hanya valid dari DRAFT", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(admin())
      .send({ partnerId: base.partner.id, items: [{ productId: base.product.id, quantity: 5 }] });

    const id = created.body.data.id;
    const confirm = await request(app).post(`/api/po/${id}/confirm`).set(admin());
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe("CONFIRMED");

    const again = await request(app).post(`/api/po/${id}/confirm`).set(admin());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_STATE");
  });

  it("AC-08: PO dari AI selalu DRAFT dan muncul di antrean admin (AC-07)", async () => {
    const res = await request(app)
      .post("/api/po/draft")
      .set("x-internal-key", INTERNAL_KEY)
      .send({
        partnerName: "PT Test Jaya",
        chatId: "900001",
        items: [{ productName: "Dimsum", qty: 50 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.source).toBe("AI_CHAT");

    const list = await request(app).get("/api/po?status=DRAFT").set(admin());
    expect(list.status).toBe(200);
    expect(list.body.data.some((po: { poNumber: string }) => po.poNumber === res.body.data.poNumber)).toBe(true);
  });

  it("menolak /po/draft dari chatId tak terdaftar", async () => {
    const res = await request(app)
      .post("/api/po/draft")
      .set("x-internal-key", INTERNAL_KEY)
      .send({ partnerName: "PT Test Jaya", chatId: "000000", items: [{ productName: "Dimsum", qty: 1 }] });
    expect(res.status).toBe(403);
  });

  it("AC-12: hapus PO DRAFT menghapus item (cascade)", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(admin())
      .send({ partnerId: base.partner.id, items: [{ productId: base.product.id, quantity: 3 }] });
    const id = created.body.data.id;

    const del = await request(app).delete(`/api/po/${id}`).set(admin());
    expect(del.status).toBe(200);

    const items = await prisma.purchaseOrderItem.count({ where: { poId: id } });
    expect(items).toBe(0);
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    expect(po).toBeNull();
  });

  it("menolak hapus PO yang sudah CONFIRMED", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(admin())
      .send({ partnerId: base.partner.id, items: [{ productId: base.product.id, quantity: 2 }] });
    const id = created.body.data.id;
    await request(app).post(`/api/po/${id}/confirm`).set(admin());

    const del = await request(app).delete(`/api/po/${id}`).set(admin());
    expect(del.status).toBe(409);
  });
});

describe("Delivery Note (AC-14)", () => {
  it("membuat DN dari PO CONFIRMED", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(admin())
      .send({
        partnerId: base.partner.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 4 }],
      });
    const poId = created.body.data.id;
    await request(app).post(`/api/po/${poId}/confirm`).set(admin());

    const dn = await request(app)
      .post("/api/delivery-notes")
      .set(admin())
      .send({ poId, shipDate: new Date().toISOString() });

    expect(dn.status).toBe(201);
    expect(dn.body.data.dnNumber).toMatch(/^SJ-\d{6}-\d{3}$/);
    expect(dn.body.data.status).toBe("DRAFT");
    expect(dn.body.data.items).toHaveLength(1);
  });

  it("menolak DN dari PO DRAFT", async () => {
    const created = await request(app)
      .post("/api/po")
      .set(admin())
      .send({
        partnerId: base.partner.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 4 }],
      });

    const dn = await request(app)
      .post("/api/delivery-notes")
      .set(admin())
      .send({ poId: created.body.data.id, shipDate: new Date().toISOString() });

    expect(dn.status).toBe(409);
    expect(dn.body.error.code).toBe("INVALID_STATE");
  });

  it("DRAFT -> SHIPPED membuat transaksi OUT otomatis (FR-07.4)", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });

    const created = await request(app)
      .post("/api/po")
      .set(admin())
      .send({
        partnerId: base.partner.id,
        warehouseId: base.warehouse.id,
        items: [{ productId: base.product.id, quantity: 7 }],
      });
    await request(app).post(`/api/po/${created.body.data.id}/confirm`).set(admin());
    const dn = await request(app)
      .post("/api/delivery-notes")
      .set(admin())
      .send({ poId: created.body.data.id, shipDate: new Date().toISOString() });

    const ship = await request(app)
      .patch(`/api/delivery-notes/${dn.body.data.id}`)
      .set(admin())
      .send({ status: "SHIPPED" });

    expect(ship.status).toBe(200);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    expect(after.stock).toBe(before.stock - 7);
  });
});

describe("Audit log (FR-10)", () => {
  it("Super Admin dapat melihat audit log; Admin ditolak", async () => {
    const ok = await request(app).get("/api/audit-logs?limit=5").set("Authorization", `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.meta.total).toBeGreaterThan(0);

    const denied = await request(app).get("/api/audit-logs").set(admin());
    expect(denied.status).toBe(403);
  });
});
