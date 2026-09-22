import { describe, expect, it } from "vitest";
import {
  assertPoTransition,
  canTransitionDn,
  canTransitionPo,
} from "../../src/utils/po-state";
import { AppError } from "../../src/lib/errors";

describe("PO state machine (FSD §11.1)", () => {
  it("mengizinkan DRAFT -> CONFIRMED dan DRAFT -> CANCELLED", () => {
    expect(canTransitionPo("DRAFT", "CONFIRMED")).toBe(true);
    expect(canTransitionPo("DRAFT", "CANCELLED")).toBe(true);
  });

  it("mengizinkan CONFIRMED -> COMPLETED / CANCELLED", () => {
    expect(canTransitionPo("CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransitionPo("CONFIRMED", "CANCELLED")).toBe(true);
  });

  it("menolak transisi dari state final", () => {
    expect(canTransitionPo("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionPo("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("menolak lompatan DRAFT -> COMPLETED", () => {
    expect(canTransitionPo("DRAFT", "COMPLETED")).toBe(false);
  });

  it("assertPoTransition melempar AppError INVALID_STATE", () => {
    expect(() => assertPoTransition("DRAFT", "COMPLETED")).toThrow(AppError);
    try {
      assertPoTransition("DRAFT", "COMPLETED");
    } catch (e) {
      expect((e as AppError).code).toBe("INVALID_STATE");
      expect((e as AppError).statusCode).toBe(409);
    }
  });
});

describe("Delivery Note state machine (FR-07.6)", () => {
  it("mengizinkan DRAFT -> SHIPPED/CANCELLED dan SHIPPED -> DELIVERED", () => {
    expect(canTransitionDn("DRAFT", "SHIPPED")).toBe(true);
    expect(canTransitionDn("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransitionDn("SHIPPED", "CANCELLED")).toBe(true);
  });

  it("menolak DELIVERED -> apa pun", () => {
    expect(canTransitionDn("DELIVERED", "CANCELLED")).toBe(false);
  });
});
