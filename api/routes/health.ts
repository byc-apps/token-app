import { Hono } from "hono";
import type { AppEnv } from "../types";

export const healthRoutes = new Hono<AppEnv>();

/** Public, no database access, reveals nothing about the system. */
healthRoutes.get("/health", (c) => c.json({ status: "ok" }));
