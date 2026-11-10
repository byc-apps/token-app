import { createMiddleware } from "hono/factory";
import { forbidden } from "../lib/errors";
import {
  hasPermission,
  isGlobalRole,
  type Permission,
  type Role,
} from "../shared/roles";
import type { UserWithId } from "../shared/schemas";
import type { AppEnv } from "../types";

/** Route guard. Use AFTER requireAuth:  app.get("/x", requireAuth, requirePermission("reports:all"), ...) */
export const requirePermission = (permission: Permission) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!hasPermission(c.get("user").role, permission)) throw forbidden();
    await next();
  });

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) throw forbidden();
    await next();
  });

/** Global roles see every centre; centre roles only the centres assigned to them. */
export function canAccessCentre(user: UserWithId, centreId: string): boolean {
  return isGlobalRole(user.role) || user.centreIds.includes(centreId);
}

/** Call inside a handler once you know which centre the request touches. */
export function assertCentreAccess(user: UserWithId, centreId: string): void {
  if (!canAccessCentre(user, centreId)) throw forbidden();
}
