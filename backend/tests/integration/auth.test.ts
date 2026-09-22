import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { resetDb, seedBaseline } from "../helpers/db";

const app = createApp();

beforeAll(async () => {
  await resetDb();
  await seedBaseline();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Authentication", () => {
  it("AC-01: login sukses mengembalikan access & refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.id", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.role).toBe("ADMIN");
  });

  it("menolak password salah dengan 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.id", password: "salah" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("menolak input tidak valid dengan 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "bukan-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refresh token menerbitkan pasangan token baru", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.id", password: "password123" });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refresh: login.body.data.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(login.body.data.refreshToken);
  });
});

describe("RBAC (AC-02)", () => {
  it("menolak ADMIN mengakses /api/users dengan 403", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.id", password: "password123" });

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("tanpa token mengembalikan 401", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });
});

describe("Internal auth", () => {
  it("menolak x-internal-key yang salah", async () => {
    const res = await request(app)
      .post("/api/internal/ai-log")
      .set("x-internal-key", "salah")
      .send({ platform: "TELEGRAM", chatId: "900001", messageIn: "halo" });
    expect(res.status).toBe(403);
  });

  it("menerima key valid dan memetakan chatId ke user", async () => {
    const res = await request(app)
      .post("/api/internal/ai-log")
      .set("x-internal-key", "test_internal_key")
      .send({ platform: "TELEGRAM", chatId: "900001", messageIn: "cek stok" });
    expect(res.status).toBe(201);
    expect(res.body.data.registered).toBe(true);
  });
});
