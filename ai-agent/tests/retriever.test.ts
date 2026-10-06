import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb } = vi.hoisted(() => ({ fakeDb: { query: vi.fn() } }));

vi.mock("../src/infrastructure/db", () => ({ db: fakeDb }));
vi.mock("../src/infrastructure/rag/embeddings", () => ({
  getEmbeddings: () => ({ embedQuery: async () => [0.1, 0.2, 0.3] }),
}));

import { searchKnowledge } from "../src/infrastructure/rag/retriever";

beforeEach(() => {
  fakeDb.query.mockReset();
});

describe("searchKnowledge", () => {
  it("membuang hasil vector di bawah minScore (hybrid)", async () => {
    fakeDb.query.mockResolvedValue({
      rows: [
        { source: "a.md", title: "A", docType: "sop", content: "relevan", score: 0.9, vectorMatch: true, textMatch: false },
        { source: "b.md", title: "B", docType: "sop", content: "lemah", score: 0.1, vectorMatch: true, textMatch: false },
        { source: "c.md", title: "C", docType: "sop", content: "cocok kata kunci", score: 0.05, vectorMatch: false, textMatch: true },
      ],
    });

    const result = await searchKnowledge("retur", { minScore: 0.3, docTypes: ["sop"] });

    expect(result.map((r) => r.source)).toEqual(["a.md", "c.md"]);
    expect(result[0]).toMatchObject({ title: "A", docType: "sop" });
  });

  it("mengembalikan array kosong saat terjadi error (degradasi anggun)", async () => {
    fakeDb.query.mockRejectedValue(new Error("db down"));
    const result = await searchKnowledge("apa saja");
    expect(result).toEqual([]);
  });

  it("meneruskan filter docTypes ke query", async () => {
    fakeDb.query.mockResolvedValue({ rows: [] });
    await searchKnowledge("x", { docTypes: ["kebijakan", "runbook"] });
    const params = fakeDb.query.mock.calls[0][1] as unknown[];
    expect(params[2]).toEqual(["kebijakan", "runbook"]);
  });
});
