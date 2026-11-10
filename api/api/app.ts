import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { AppError, errorBody } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import type { AppEnv } from "./types";

export const app = new Hono<AppEnv>().basePath("/api");

// 1. Request id (returned to the client so errors can be traced in logs)
app.use("*", async (c, next) => {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
});

// 2. Security headers + never cache API responses
app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

// 3. Reject oversized bodies (OWASP: resource exhaustion)
app.use(
  "*",
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) =>
      c.json(errorBody("PAYLOAD_TOO_LARGE", "Request body is too large.", c.get("requestId")), 413),
  }),
);

// Routes
app.route("/", healthRoutes);
app.route("/", authRoutes);

app.notFound((c) =>
  c.json(errorBody("NOT_FOUND", "Route not found.", c.get("requestId")), 404),
);

// One place that turns every failure into a safe JSON response (no stack traces).
app.onError((err, c) => {
  const requestId = c.get("requestId");
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, requestId), err.status);
  }
  if (err instanceof HTTPException) {
    const status = err.status === 401 || err.status === 403 || err.status === 404 ? err.status : 400;
    return c.json(errorBody("BAD_REQUEST", "Invalid request.", requestId), status);
  }
  console.error("unhandled_error", { requestId, name: err.name, message: err.message });
  return c.json(errorBody("INTERNAL_ERROR", "Something went wrong. Please try again.", requestId), 500);
});
