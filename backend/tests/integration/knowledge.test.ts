import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/infrastructure/prisma/client";
import { loginAs, resetDb, seedBaseline } from "../helpers/db";

const app = createApp();
let superToken: string;
let adminToken: string;

const superBearer = () => ({ Authorization: `Bearer ${superToken}` });
const adminBearer = () => ({ Authorization: `Bearer ${adminToken}` });

beforeAll(async () => {
  await resetDb();
  await seedBaseline();
  superToken = (await loginAs("super@test.id")).accessToken;
  adminToken = (await loginAs("admin@test.id")).accessToken;
});

describe("Knowledge Base API", () => {
  it("menolak akses selain SUPER_ADMIN", async () => {
    const res = await request(app).get("/api/knowledge/documents").set(adminBearer());
    expect(res.status).toBe(403);
  });

  it("CRUD dokumen knowledge oleh SUPER_ADMIN", async () => {
    const created = await request(app)
      .post("/api/knowledge/documents")
      .set(superBearer())
      .send({ title: "SOP Retur", docType: "faq", content: "Verifikasi retur maksimal 1x24 jam." });

    expect(created.status).toBe(201);
    const doc = created.body.data;
    expect(doc).toMatchObject({ title: "SOP Retur", docType: "faq", version: 1, isActive: true });

    const list = await request(app).get("/api/knowledge/documents").set(superBearer());
    expect(list.status).toBe(200);
    expect(list.body.data.some((d: { id: string }) => d.id === doc.id)).toBe(true);

    const detail = await request(app).get(`/api/knowledge/documents/${doc.id}`).set(superBearer());
    expect(detail.body.data.content).toContain("1x24 jam");

    const updated = await request(app)
      .patch(`/api/knowledge/documents/${doc.id}`)
      .set(superBearer())
      .send({ content: "Verifikasi retur maksimal 2x24 jam." });
    expect(updated.status).toBe(200);
    expect(updated.body.data.version).toBe(2);

    const removed = await request(app)
      .delete(`/api/knowledge/documents/${doc.id}`)
      .set(superBearer());
    expect(removed.status).toBe(200);

    const after = await request(app).get(`/api/knowledge/documents/${doc.id}`).set(superBearer());
    expect(after.body.data.isActive).toBe(false);
  });

  it("mengembalikan statistik index", async () => {
    const res = await request(app).get("/api/knowledge/stats").set(superBearer());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalChunks");
    expect(res.body.data).toHaveProperty("byType");
  });

  it("menampilkan waktu ingest terakhir dari job terbaru", async () => {
    await prisma.$executeRaw`
      INSERT INTO "ingest_jobs" ("id", "status", "startedAt", "finishedAt", "createdAt")
      VALUES (
        'test-job-1',
        'done',
        ${new Date("2026-10-06T08:02:00.000Z")},
        ${new Date("2026-10-06T08:02:30.000Z")},
        now()
      )
    `;

    const res = await request(app).get("/api/knowledge/stats").set(superBearer());
    expect(res.status).toBe(200);
    expect(new Date(res.body.data.lastIngest).toISOString()).toBe("2026-10-06T08:02:30.000Z");
  });
});
