import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { Errors } from "../lib/errors";

export type JwtPayload = { sub: string; role: UserRole };

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  });
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Errors.unauthenticated());
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as JwtPayload;
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
