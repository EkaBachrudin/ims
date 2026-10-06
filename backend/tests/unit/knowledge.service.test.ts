import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  triggerIngest: vi.fn().mockResolvedValue({ status: "running" }),
  auditRecord: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../src/composition/container", () => ({
  container: {
    audit: { record: mocks.auditRecord },
    indexer: { triggerIngest: mocks.triggerIngest, getStatus: vi.fn() },
  },
}));

vi.mock("../../src/modules/knowledge/knowledge.repository", () => ({
  findById: mocks.findById,
  create: mocks.create,
  update: mocks.update,
}));

import { env } from "../../src/config/env";
import {
  createDocument,
  deleteDocument,
  updateDocument,
} from "../../src/modules/knowledge/knowledge.service";

const baseDoc = { id: "doc-1", content: "lama", isActive: true };

beforeEach(() => {
  mocks.triggerIngest.mockReset().mockResolvedValue({ status: "running" });
  mocks.auditRecord.mockReset().mockResolvedValue(undefined);
  mocks.findById.mockReset();
  mocks.create.mockReset();
  mocks.update.mockReset();
  env.RAG_AUTO_INGEST = true;
});

afterEach(() => {
  env.RAG_AUTO_INGEST = true;
});

describe("knowledge.service auto-ingest", () => {
  it("memicu ingest setelah create", async () => {
    mocks.create.mockResolvedValue({ id: "doc-1", title: "T", docType: "sop" });

    await createDocument(
      { title: "T", docType: "sop", content: "isi" },
      "user-1",
      "127.0.0.1",
    );

    expect(mocks.triggerIngest).toHaveBeenCalledWith({ documentId: "doc-1" });
  });

  it("memicu ingest setelah update konten", async () => {
    mocks.findById.mockResolvedValue(baseDoc);
    mocks.update.mockResolvedValue({ ...baseDoc, content: "baru" });

    await updateDocument("doc-1", { content: "baru" }, "user-1", "127.0.0.1");

    expect(mocks.triggerIngest).toHaveBeenCalledWith({ documentId: "doc-1" });
  });

  it("tidak memicu ingest saat hanya filename berubah", async () => {
    mocks.findById.mockResolvedValue(baseDoc);
    mocks.update.mockResolvedValue({ ...baseDoc, filename: "x.md" });

    await updateDocument("doc-1", { filename: "x.md" }, "user-1", "127.0.0.1");

    expect(mocks.triggerIngest).not.toHaveBeenCalled();
  });

  it("memicu ingest (prune) setelah delete", async () => {
    mocks.findById.mockResolvedValue(baseDoc);
    mocks.update.mockResolvedValue({ ...baseDoc, isActive: false });

    await deleteDocument("doc-1", "user-1", "127.0.0.1");

    expect(mocks.triggerIngest).toHaveBeenCalledWith({ documentId: "doc-1" });
  });

  it("tetap sukses walau indexer menolak (best-effort)", async () => {
    mocks.create.mockResolvedValue({ id: "doc-1", title: "T", docType: "sop" });
    mocks.triggerIngest.mockRejectedValueOnce(new Error("Ingest sedang berjalan"));

    await expect(
      createDocument({ title: "T", docType: "sop", content: "isi" }, "user-1", "127.0.0.1"),
    ).resolves.toMatchObject({ id: "doc-1" });
  });

  it("tidak memicu ingest bila RAG_AUTO_INGEST=false", async () => {
    env.RAG_AUTO_INGEST = false;
    mocks.create.mockResolvedValue({ id: "doc-1", title: "T", docType: "sop" });

    await createDocument({ title: "T", docType: "sop", content: "isi" }, "user-1", "127.0.0.1");

    expect(mocks.triggerIngest).not.toHaveBeenCalled();
  });
});
