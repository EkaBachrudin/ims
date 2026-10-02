import type { RequestHandler } from "express";
import { env } from "../config/env";
import { Errors } from "../lib/errors";
import { verifyAccessToken } from "../infrastructure/auth/tokens";

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Errors.unauthenticated());
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(Errors.unauthenticated());
  }
};

/** Internal auth untuk AI Agent (endpoint /po/draft, /reports/*, /internal/*). */
export const requireInternalKey: RequestHandler = (req, _res, next) => {
  if (req.headers["x-internal-key"] !== env.INTERNAL_API_KEY) return next(Errors.forbidden());
  next();
};

/** Terima Bearer token ATAU x-internal-key (dipakai endpoint konsumen ganda web + AI). */
export const authenticateOrInternal: RequestHandler = (req, res, next) => {
  if (req.headers["x-internal-key"] === env.INTERNAL_API_KEY) return next();
  return authenticate(req, res, next);
};
