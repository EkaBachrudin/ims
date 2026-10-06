import type { DnStatus, PoStatus, Role } from "@/types";

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);
}

export const poStatusTone: Record<PoStatus, "slate" | "blue" | "green" | "red"> = {
  DRAFT: "slate",
  CONFIRMED: "blue",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const dnStatusTone: Record<DnStatus, "slate" | "blue" | "green" | "red"> = {
  DRAFT: "slate",
  SHIPPED: "blue",
  DELIVERED: "green",
  CANCELLED: "red",
};

export const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin Gudang",
  OWNER: "Owner",
};

export function todayInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function dateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function toInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/** Tanggal input (YYYY-MM-DD) N hari dari hari ini. */
export function dateInputOffset(days: number, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toInput(d);
}

/** Hari pertama bulan berjalan sebagai tanggal input. */
export function monthStartInput(base = new Date()): string {
  return toInput(new Date(base.getFullYear(), base.getMonth(), 1));
}

/** Geser tanggal input (YYYY-MM-DD) sejumlah hari. */
export function shiftDateInput(value: string, days: number): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  d.setDate(d.getDate() + days);
  return toInput(d);
}

/** Selisih hari antara dua tanggal input. */
export function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
