import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { Errors } from "../lib/errors";

/**
 * Validasi `body`, `query`, dan/atau `params` dengan Zod.
 * Hasil parsing ditulis kembali ke request agar ter-trim & ter-konversi.
 */
export const validate =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join(".");
      const message = issue ? `${path ? `${path}: ` : ""}${issue.message}` : "Invalid input";
      return next(Errors.validation(message));
    }

    const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body !== undefined) req.body = data.body;
    if (data.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: data.query,
        writable: true,
        configurable: true,
      });
    }
    if (data.params !== undefined) {
      Object.defineProperty(req, "params", {
        value: data.params,
        writable: true,
        configurable: true,
      });
    }
    next();
  };

export { ZodError };
