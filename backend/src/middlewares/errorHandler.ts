import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { isProd } from "../config/env";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Unexpected server error";

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = err.issues[0]?.message ?? "Invalid input";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      code = "CONFLICT";
      message = "Data sudah ada (melanggar constraint unik)";
    } else if (err.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "Data tidak ditemukan";
    } else if (err.code === "P2003") {
      status = 409;
      code = "CONFLICT";
      message = "Data masih direferensikan oleh data lain";
    }
  }

  if (status >= 500 && !isProd) {
    console.error(err);
  }

  res.status(status).json({ success: false, error: { code, message } });
};
