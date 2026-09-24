import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { loginAs, resetDb, seedBaseline, type Baseline } from "../helpers/db";

const app = createApp();
let base: Baseline;
let token: string;

const internal = { "x-internal-key": "test_internal_key" };
const CHAT_ID = "900001"; // telegramId owner pada seed
const bearer = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await resetDb();
  base = await seedBaseline();
  await prisma.product.createMany({
    data: [
      {
        sku: "SEA-012",
        name: "Cumi-Cumi Beku 1kg",
        unit: "kg",
        stock: 50,
        minStock: 5,
        categoryId: base.category.id,
      },
      {
        sku: "SEA-011",
        name: "Cumi-Cumi Beku 500g",
        unit: "pack",
        stock: 50,
        minStock: 5,
        categoryId: base.category.id,
      },
    ],
  });
  token = (await loginAs("admin@test.id")).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Draft Surat Jalan via chat (internal)", () => {
  it("membuat DN DRAFT untuk customer tanpa mengubah stok", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });

    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .set(internal)
      .send({
        partnerName: "PT Test Jaya",
        items: [{ productName: "Dimsum", qty: 3 }],
        shipDate: "2026-09-25",
        chatId: CHAT_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.dnNumber).toMatch(/^SJ-/);
    expect(res.body.data.partner.name).toBe("PT Test Jaya");
    expect(res.body.data.items[0].quantity).toBe(3);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: base.product.id } });
    expect(after.stock).toBe(before.stock);
  });

  it("menolak partner bertipe SUPPLIER (422)", async () => {
    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .set(internal)
      .send({
        partnerName: "CV Test Sumber",
        items: [{ productName: "Dimsum", qty: 1 }],
        chatId: CHAT_ID,
      });
    expect(res.status).toBe(422);
  });

  it("menolak produk yang tidak dikenal (422)", async () => {
    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .set(internal)
      .send({
        partnerName: "PT Test Jaya",
        items: [{ productName: "Barang Tidak Ada", qty: 1 }],
        chatId: CHAT_ID,
      });
    expect(res.status).toBe(422);
  });

  it("mencocokkan nama produk bebas user ke nama katalog", async () => {
    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .set(internal)
      .send({
        partnerName: "PT Test Jaya",
        items: [{ productName: "cumi2 beku 1 kilo", qty: 2 }],
        chatId: CHAT_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items[0].product.name).toBe("Cumi-Cumi Beku 1kg");
  });

  it("menolak nama produk ambigu dan menyebutkan kandidat (422)", async () => {
    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .set(internal)
      .send({
        partnerName: "PT Test Jaya",
        items: [{ productName: "cumi beku", qty: 1 }],
        chatId: CHAT_ID,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain("Cumi-Cumi Beku 1kg");
    expect(res.body.error.message).toContain("Cumi-Cumi Beku 500g");
  });

  it("menolak chatId yang tidak terdaftar (403)", async () => {
    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .set(internal)
      .send({
        partnerName: "PT Test Jaya",
        items: [{ productName: "Dimsum", qty: 1 }],
        chatId: "tidak-terdaftar",
      });
    expect(res.status).toBe(403);
  });

  it("menolak tanpa internal key (403)", async () => {
    const res = await request(app)
      .post("/api/delivery-notes/draft")
      .send({
        partnerName: "PT Test Jaya",
        items: [{ productName: "Dimsum", qty: 1 }],
        chatId: CHAT_ID,
      });
    expect(res.status).toBe(403);
  });

  it("membutuhkan autentikasi Bearer (401) dan tetap tersedia untuk web", async () => {
    const unauthorized = await request(app).get("/api/delivery-notes");
    expect(unauthorized.status).toBe(401);

    const res = await request(app)
      .get("/api/delivery-notes")
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});

describe("Edit DN & transaksi OUT terkait", () => {
  let dnId = "";
  let dnNumber = "";

  it("membuat DN DRAFT untuk customer", async () => {
    const res = await request(app)
      .post("/api/delivery-notes")
      .set(bearer())
      .send({
        partnerId: base.partner.id,
        warehouseId: base.warehouse.id,
        shipDate: "2026-09-26",
        items: [{ productId: base.product.id, quantity: 4 }],
      });
    expect(res.status).toBe(201);
    dnId = res.body.data.id;
    dnNumber = res.body.data.dnNumber;
    expect(res.body.data.status).toBe("DRAFT");
  });

  it("mengubah item & catatan DN selama DRAFT", async () => {
    const res = await request(app)
      .put(`/api/delivery-notes/${dnId}`)
      .set(bearer())
      .send({ notes: "diedit", items: [{ productId: base.product.id, quantity: 9 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe("diedit");
    expect(res.body.data.items[0].quantity).toBe(9);
  });

  it("menolak edit setelah SHIPPED (409)", async () => {
    await request(app)
      .patch(`/api/delivery-notes/${dnId}`)
      .set(bearer())
      .send({ status: "SHIPPED" });

    const res = await request(app)
      .put(`/api/delivery-notes/${dnId}`)
      .set(bearer())
      .send({ notes: "x" });
    expect(res.status).toBe(409);
  });

  it("menyediakan transaksi OUT terkait via filter deliveryNoteId", async () => {
    const res = await request(app).get(`/api/transactions?deliveryNoteId=${dnId}`).set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].type).toBe("OUT");
    expect(res.body.data[0].quantity).toBe(9);
    expect(res.body.data[0].deliveryNote.dnNumber).toBe(dnNumber);
  });
});
