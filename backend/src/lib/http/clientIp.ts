/** Ambil IP klien dari header proxy (`x-forwarded-for`) atau koneksi langsung. */
export function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? null;
}
