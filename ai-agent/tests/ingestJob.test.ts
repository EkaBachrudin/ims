import { beforeEach, describe, expect, it, vi } from "vitest";

const fakePool = { query: vi.fn(), end: vi.fn() };
const runIngest = vi.fn();

vi.mock("../src/infrastructure/db", () => ({
  ingestPool: () => fakePool,
  db: {},
}));
vi.mock("../src/infrastructure/rag/ingest", () => ({
  runIngest: (...args: unknown[]) => runIngest(...args),
}));

import {
  loadLatestJob,
  markJobInterrupted,
  runIngestJob,
} from "../src/infrastructure/rag/ingestJobStore";

function sqls(): string[] {
  return fakePool.query.mock.calls.map((c) => String(c[0]));
}

beforeEach(() => {
  fakePool.query.mockReset();
  runIngest.mockReset();
  fakePool.query.mockImplementation(async (sql: string) => {
    if (String(sql).includes("RETURNING")) return { rows: [{ id: "job-1" }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
});

describe("ingestJobStore", () => {
  it("mencatat job running lalu done beserta hasilnya", async () => {
    const results = [{ documentId: "doc-1", source: "a.md", chunks: 2, skipped: false }];
    runIngest.mockResolvedValue(results);

    const out = await runIngestJob(fakePool as never, { docType: "sop" });

    expect(out).toEqual(results);
    const all = sqls();
    expect(all.some((s) => s.includes('INSERT INTO "ingest_jobs"'))).toBe(true);
    const updateCall = fakePool.query.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE "ingest_jobs"'),
    );
    expect(updateCall?.[1]).toContain("done");
  });

  it("menandai job error saat ingest gagal dan meneruskan error", async () => {
    runIngest.mockRejectedValue(new Error("embed gagal"));

    await expect(runIngestJob(fakePool as never)).rejects.toThrow("embed gagal");

    const updateCall = fakePool.query.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE "ingest_jobs"'),
    );
    expect(updateCall?.[1]).toContain("error");
    expect(updateCall?.[1]).toContain("embed gagal");
  });

  it("memuat job terakhir dengan konversi tanggal ke ISO", async () => {
    fakePool.query.mockResolvedValue({
      rows: [
        {
          id: "job-9",
          status: "done",
          startedAt: new Date("2026-10-06T08:02:00.000Z"),
          finishedAt: new Date("2026-10-06T08:02:30.000Z"),
          error: null,
          results: [{ documentId: "d", source: "s", chunks: 1, skipped: false }],
        },
      ],
      rowCount: 1,
    });

    const job = await loadLatestJob(fakePool as never);

    expect(job).toMatchObject({
      id: "job-9",
      status: "done",
      startedAt: "2026-10-06T08:02:00.000Z",
      finishedAt: "2026-10-06T08:02:30.000Z",
    });
    expect(job?.results).toHaveLength(1);
  });

  it("mengembalikan null bila belum ada job", async () => {
    fakePool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(loadLatestJob(fakePool as never)).resolves.toBeNull();
  });

  it("markJobInterrupted hanya mengubah job yang masih running", async () => {
    await markJobInterrupted(fakePool as never, "job-1");

    const call = fakePool.query.mock.calls[0];
    expect(String(call[0])).toContain("'error'");
    expect(String(call[0])).toContain(`"status" = 'running'`);
    expect(call[1]).toEqual(["job-1", "Job terputus (AI Agent restart)"]);
  });
});
