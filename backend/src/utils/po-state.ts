import type { DnStatus, PoStatus } from "@prisma/client";
import { Errors } from "../lib/errors";

const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const DN_TRANSITIONS: Record<DnStatus, DnStatus[]> = {
  DRAFT: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionPo(from: PoStatus, to: PoStatus): boolean {
  return PO_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPoTransition(from: PoStatus, to: PoStatus): void {
  if (!canTransitionPo(from, to)) {
    throw Errors.invalidState(`Cannot change PO ${from} -> ${to}`);
  }
}

export function canTransitionDn(from: DnStatus, to: DnStatus): boolean {
  return DN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertDnTransition(from: DnStatus, to: DnStatus): void {
  if (!canTransitionDn(from, to)) {
    throw Errors.invalidState(`Cannot change Delivery Note ${from} -> ${to}`);
  }
}
