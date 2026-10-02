import type { Response } from "express";

/** Bentuk respons sukses standar: `{ success: true, data }`. */
export function ok<T>(res: Response, data: T): Response {
  return res.json({ success: true, data });
}

/** Respons sukses dengan metadata paginasi. */
export function okList<T>(res: Response, data: T, meta: unknown): Response {
  return res.json({ success: true, data, meta });
}

/** Respons pembuatan resource (HTTP 201). */
export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data });
}
