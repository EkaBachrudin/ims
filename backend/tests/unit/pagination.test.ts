import { describe, expect, it } from "vitest";
import { buildMeta, parsePagination } from "../../src/utils/pagination";

describe("parsePagination", () => {
  it("default page 1 limit 20", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it("menghitung skip dari page", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
      take: 10,
    });
  });

  it("membatasi limit maksimum 100", () => {
    expect(parsePagination({ limit: "500" }).limit).toBe(100);
  });

  it("menormalkan nilai tidak valid", () => {
    expect(parsePagination({ page: "-2", limit: "abc" })).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });
});

describe("buildMeta", () => {
  it("menghitung totalPages", () => {
    expect(buildMeta(1, 20, 45)).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 });
  });
});
