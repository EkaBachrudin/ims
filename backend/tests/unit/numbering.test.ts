import { describe, expect, it, vi } from "vitest";
import { generateDnNumber, generatePoNumber } from "../../src/utils/numbering";
import type { PrismaTx } from "../../src/lib/prisma";

function mockTx(count: number) {
  return {
    purchaseOrder: { count: vi.fn().mockResolvedValue(count) },
    deliveryNote: { count: vi.fn().mockResolvedValue(count) },
  } as unknown as PrismaTx;
}

describe("generatePoNumber (BR-RULE-003)", () => {
  it("membuat nomor PO-YYYYMM-001 saat belum ada", async () => {
    const tx = mockTx(0);
    const poNumber = await generatePoNumber(tx, new Date("2026-09-22T00:00:00Z"));
    expect(poNumber).toBe("PO-202609-001");
  });

  it("menaikkan sequence sesuai jumlah existing", async () => {
    const tx = mockTx(4);
    const poNumber = await generatePoNumber(tx, new Date("2026-09-01T00:00:00Z"));
    expect(poNumber).toBe("PO-202609-005");
  });
});

describe("generateDnNumber", () => {
  it("membuat nomor SJ-YYYYMM-NNN", async () => {
    const tx = mockTx(1);
    const dnNumber = await generateDnNumber(tx, new Date("2026-10-05T00:00:00Z"));
    expect(dnNumber).toBe("SJ-202610-002");
  });
});
