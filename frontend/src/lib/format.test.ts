import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, todayInput } from "@/lib/format";

describe("format helpers", () => {
  it("formatDate mengembalikan '-' untuk nilai kosong", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });

  it("formatDate memformat tanggal valid", () => {
    expect(formatDate("2026-09-22T00:00:00.000Z")).toMatch(/2026/);
  });

  it("formatCurrency memformat rupiah", () => {
    const result = formatCurrency(50000);
    expect(result).toContain("50");
  });

  it("formatCurrency '-' untuk null", () => {
    expect(formatCurrency(null)).toBe("-");
  });

  it("todayInput berformat YYYY-MM-DD", () => {
    expect(todayInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
