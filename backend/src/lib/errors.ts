export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export const Errors = {
  validation: (message = "Invalid input") => new AppError("VALIDATION_ERROR", 400, message),
  unauthenticated: (message = "Missing or invalid token") =>
    new AppError("UNAUTHENTICATED", 401, message),
  forbidden: (message = "Insufficient role") => new AppError("FORBIDDEN", 403, message),
  notFound: (what = "Resource") => new AppError("NOT_FOUND", 404, `${what} not found`),
  conflict: (message = "Resource already exists") => new AppError("CONFLICT", 409, message),
  insufficientStock: () =>
    new AppError("INSUFFICIENT_STOCK", 409, "Outbound exceeds available stock"),
  invalidState: (message = "Illegal state transition") =>
    new AppError("INVALID_STATE", 409, message),
  unprocessable: (message = "Business rule violation") =>
    new AppError("UNPROCESSABLE", 422, message),
  internal: (message = "Unexpected server error") =>
    new AppError("INTERNAL_ERROR", 500, message),
};
