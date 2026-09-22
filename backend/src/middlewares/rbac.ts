import type { RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { Errors } from "../lib/errors";

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(Errors.unauthenticated());
    if (!roles.includes(req.user.role)) return next(Errors.forbidden());
    next();
  };
