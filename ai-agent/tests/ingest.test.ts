import { describe, expect, it, vi, beforeEach } from "vitest";

const fakePool = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  end: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../src/db", () => ({
  ingestPool: () => fakePool,
  db: {},
}));
vi.mock("../src/rag/embeddings", () => ({
  getEmbeddings: () => ({
    embedDocuments: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
  }),
}));

import { ingestAll } from "../src/rag/ingest";

beforeEach(() => {
  fakePool.query.mockClear();
  fakePool.end.mockClear();
});

describe("RAG ingestion", () => {
  it("membaca dokumen SOP, memotong chunk, dan menulis ke document_chunks", async () => {
    const results = await ingestAll();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.chunks).toBeGreaterThan(0);
      expect(r.source).toMatch(/\.md$/);
    }

    const sqls = fakePool.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes("DELETE FROM document_chunks WHERE source"))).toBe(true);
    expect(sqls.some((s) => s.includes("INSERT INTO document_chunks"))).toBe(true);
    expect(fakePool.end).toHaveBeenCalled();
  });

  it("setiap source punya operasi DELETE sebelum INSERT (idempoten)", async () => {
    await ingestAll();
    const calls = fakePool.query.mock.calls;
    const firstDelete = calls.findIndex((c) => String(c[0]).includes("DELETE FROM document_chunks"));
    const firstInsert = calls.findIndex((c) => String(c[0]).includes("INSERT INTO document_chunks"));
    expect(firstDelete).toBeGreaterThanOrEqual(0);
    expect(firstDelete).toBeLessThan(firstInsert);
  });
});
