/**
 * Single source of truth for roles and permissions.
 * Used by the API (enforcement) and, later, the frontend (UI hints only).
 * NEVER trust a role sent by the client — the API reads it from Firestore.
 */
export const ROLES = [
  "app_admin",
  "campus_authority",
  "centre_admin",
  "centre_staff",
  "student_faculty",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  app_admin: "App Admin",
  campus_authority: "Campus Authority",
  centre_admin: "Centre Admin",
  centre_staff: "Centre Staff",
  student_faculty: "Student / Faculty",
};

export const PERMISSIONS = [
  "centres:manage", // create / edit centres
  "users:manage", // manage users (Centre Admin: only staff of own centres — enforced in the route)
  "centre:configure", // staff, counters, services, slots of a centre
  "tokens:manage", // approve / modify / cancel tokens
  "tokens:serve", // take token, add service notes, close token
  "walkins:create",
  "tokens:book", // student/faculty: own bookings
  "tokens:cancel_own", // student/faculty: cancel own (60 min rule enforced in route)
  "feedback:give",
  "reports:all", // all centres
  "reports:centre", // own centres
  "settings:manage", // ID formats and other app settings
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_SIDE: Permission[] = [
  "centres:manage",
  "users:manage",
  "centre:configure",
  "tokens:manage",
  "tokens:serve",
  "walkins:create",
  "reports:all",
  "reports:centre",
  "settings:manage",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  app_admin: new Set(ADMIN_SIDE),
  // Same rights as App Admin (edit rights confirmed); mainly used for reports.
  campus_authority: new Set(ADMIN_SIDE),
  centre_admin: new Set<Permission>([
    "centre:configure",
    "tokens:manage",
    "tokens:serve",
    "walkins:create",
    "reports:centre",
  ]),
  centre_staff: new Set<Permission>(["tokens:serve", "walkins:create"]),
  student_faculty: new Set<Permission>([
    "tokens:book",
    "tokens:cancel_own",
    "feedback:give",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Roles that can act on every centre. */
export function isGlobalRole(role: Role): boolean {
  return role === "app_admin" || role === "campus_authority";
}

/** Roles limited to the centres listed in the user's centreIds. */
export function isCentreRole(role: Role): boolean {
  return role === "centre_admin" || role === "centre_staff";
}
