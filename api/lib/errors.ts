export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500;

/** Errors we throw on purpose. Messages are safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (message = "Sign in required.") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have permission to do this.") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found.") => new AppError(404, "NOT_FOUND", message);
export const badRequest = (message = "Invalid request.") =>
  new AppError(400, "BAD_REQUEST", message);
export const conflict = (message = "Conflict.") => new AppError(409, "CONFLICT", message);
export const validationError = (details: unknown) =>
  new AppError(400, "VALIDATION_ERROR", "Some fields are invalid.", details);

export function errorBody(code: string, message: string, requestId?: string, details?: unknown) {
  return {
    error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
  };
}
