import { describe, expect, it } from "vitest";
import { buildDocumentNumber, numberPrefix } from "../../src/domain/numbering";

describe("numberPrefix", () => {
  it("membentuk prefix dokumen per bulan", () => {
    expect(numberPrefix("PO", new Date("2026-09-22T00:00:00Z"))).toBe("PO-202609-");
    expect(numberPrefix("SJ", new Date("2026-10-05T00:00:00Z"))).toBe("SJ-202610-");
  });
});

describe("buildDocumentNumber (BR-RULE-003)", () => {
  it("membuat nomor PO-YYYYMM-001 saat belum ada", () => {
    expect(buildDocumentNumber("PO", new Date("2026-09-22T00:00:00Z"), 0)).toBe("PO-202609-001");
  });

  it("menaikkan sequence sesuai jumlah existing", () => {
    expect(buildDocumentNumber("PO", new Date("2026-09-01T00:00:00Z"), 4)).toBe("PO-202609-005");
  });

  it("membuat nomor SJ-YYYYMM-NNN", () => {
    expect(buildDocumentNumber("SJ", new Date("2026-10-05T00:00:00Z"), 1)).toBe("SJ-202610-002");
  });
});
