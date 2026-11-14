import { hasPermission, type Permission, type Role } from "@shared/roles";

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? hasPermission(role, permission) : false;
}

export function hasRole(role: Role | null | undefined, allowed: readonly Role[]): boolean {
  return role !== null && role !== undefined && allowed.includes(role);
}
