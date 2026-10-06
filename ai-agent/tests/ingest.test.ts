import { describe, expect, it, vi, beforeEach } from "vitest";

const fakePool = {
  query: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../src/infrastructure/db", () => ({
  ingestPool: () => fakePool,
  db: {},
}));
vi.mock("../src/infrastructure/rag/embeddings", () => ({
  getEmbeddings: () => ({
    embedDocuments: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
  }),
}));

import { runIngest } from "../src/infrastructure/rag/ingest";

const docs = [
  {
    id: "doc-1",
    filename: "sop-retur.md",
    title: "SOP Retur",
    docType: "sop",
    content: "## Prosedur\nVerifikasi retur maksimal 1x24 jam.",
    metadata: null,
    version: 1,
  },
];

function primePool(documents = docs, existingChunk = false) {
  fakePool.query.mockImplementation(async (sql: string) => {
    const text = String(sql);
    if (text.includes('DELETE FROM "document_chunks"') && text.includes("NOT EXISTS")) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('FROM "knowledge_documents"')) return { rows: documents, rowCount: documents.length };
    if (text.includes('FROM "document_chunks"') && text.includes("contentHash")) {
      return { rows: [], rowCount: existingChunk ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
}

function lastHashParam(): unknown {
  const call = [...fakePool.query.mock.calls]
    .reverse()
    .find((c) => String(c[0]).includes("contentHash"));
  return (call?.[1] as unknown[] | undefined)?.[1];
}

beforeEach(() => {
  fakePool.query.mockReset();
  fakePool.end.mockClear();
});

describe("RAG ingestion (DB source)", () => {
  it("membaca knowledge_documents, memotong chunk, dan menulis ke document_chunks", async () => {
    primePool();
    const results = await runIngest(fakePool as never);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ documentId: "doc-1", source: "sop-retur.md", skipped: false });
    expect(results[0].chunks).toBeGreaterThan(0);

    const sqls = fakePool.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes("BEGIN"))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM "document_chunks"'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO "document_chunks"'))).toBe(true);
    expect(sqls.some((s) => s.includes("COMMIT"))).toBe(true);
  });

  it("melewati dokumen yang isinya tidak berubah (content hash sama)", async () => {
    primePool(docs, true);
    const results = await runIngest(fakePool as never);

    expect(results[0]).toMatchObject({ skipped: true, chunks: 0 });
    const sqls = fakePool.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('INSERT INTO "document_chunks"'))).toBe(false);
  });

  it("memangkas chunk yatim (dokumen nonaktif/hilang) setiap ingest", async () => {
    primePool();
    await runIngest(fakePool as never);

    const sqls = fakePool.query.mock.calls.map((c) => String(c[0]));
    const prune = sqls.find(
      (s) => s.includes('DELETE FROM "document_chunks"') && s.includes("NOT EXISTS"),
    );
    expect(prune).toBeTruthy();
    expect(prune).toContain('"isActive" = true');
  });

  it("menghasilkan content hash berbeda saat judul berubah (konten sama)", async () => {
    primePool(docs, true);
    await runIngest(fakePool as never);
    const hashBefore = lastHashParam();

    fakePool.query.mockReset();
    primePool([{ ...docs[0], title: "SOP Retur (revisi)" }], true);
    await runIngest(fakePool as never);
    const hashAfter = lastHashParam();

    expect(hashBefore).toBeTruthy();
    expect(hashAfter).not.toBe(hashBefore);
  });

  it("rollback bila terjadi error saat menulis chunk", async () => {
    fakePool.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes('DELETE FROM "document_chunks"') && text.includes("NOT EXISTS")) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM "knowledge_documents"')) return { rows: docs, rowCount: 1 };
      if (text.includes('FROM "document_chunks"') && text.includes("contentHash")) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('INSERT INTO "document_chunks"')) throw new Error("db error");
      return { rows: [], rowCount: 0 };
    });

    await expect(runIngest(fakePool as never)).rejects.toThrow("db error");
    const sqls = fakePool.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes("ROLLBACK"))).toBe(true);
  });
});
