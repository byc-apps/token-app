import { badRequest, conflict, forbidden } from "../lib/errors";
import {
  DEFAULT_ID_FORMATS,
  idKeyOf,
  identityProblem,
  normaliseId,
  type IdFormats,
} from "../shared/ids";
import { isCentreRole } from "../shared/roles";
import {
  roleCentreProblem,
  userDocSchema,
  type UserDoc,
  type UserPatch,
  type UserWithId,
} from "../shared/schemas";

/**
 * Pure rules for changing a user. No database access, so they are easy to test.
 * The service calls this inside a transaction and only writes if it returns.
 */

const TRACKED = [
  "name",
  "role",
  "status",
  "verified",
  "userType",
  "centreIds",
  "primaryCentreId",
  "regNo",
  "empId",
  "departmentId",
  "mobile",
] as const;

export interface UserUpdatePlan {
  /** Only the fields that actually change. */
  changes: Record<string, unknown>;
  changedFields: string[];
  disables: boolean;
  /** The user as it will look after the change. */
  next: UserDoc;
  /** idLinks keys before/after, so the service can keep the ID index in sync. */
  oldIdKey: string | null;
  newIdKey: string | null;
}

/** True when the patch would take an active App Admin out of service. */
export function removesActiveAdmin(target: UserWithId, patch: UserPatch): boolean {
  return (
    target.role === "app_admin" &&
    target.status === "active" &&
    ((patch.role !== undefined && patch.role !== "app_admin") || patch.status === "disabled")
  );
}

export function planUserUpdate(
  actor: UserWithId,
  target: UserWithId,
  patch: UserPatch,
  otherActiveAdmins = 0,
  formats: IdFormats = DEFAULT_ID_FORMATS,
): UserUpdatePlan {
  const isSelf = actor.uid === target.uid;
  const roleChanges = patch.role !== undefined && patch.role !== target.role;
  const statusChanges = patch.status !== undefined && patch.status !== target.status;

  if (isSelf && (roleChanges || patch.status === "disabled")) {
    throw forbidden("You cannot change your own role or disable your own account.");
  }

  // Campus Authority has full edit rights EXCEPT anything touching the App Admin role.
  if (actor.role !== "app_admin") {
    const touchesAdminRole =
      (roleChanges && (patch.role === "app_admin" || target.role === "app_admin")) ||
      (target.role === "app_admin" && statusChanges);
    if (touchesAdminRole) {
      throw forbidden("Only an App Admin can grant, remove or disable the App Admin role.");
    }
  }

  if (removesActiveAdmin(target, patch) && otherActiveAdmins < 1) {
    throw conflict("There must always be at least one active App Admin.");
  }

  const role = patch.role ?? target.role;
  let centreIds = patch.centreIds ?? target.centreIds;
  let primary =
    patch.primaryCentreId !== undefined ? patch.primaryCentreId : target.primaryCentreId;

  if (!isCentreRole(role)) {
    // Leaving a centre role clears centre access automatically.
    if (patch.centreIds === undefined) {
      centreIds = [];
      primary = null;
    }
  } else if (patch.primaryCentreId === undefined && (primary === null || !centreIds.includes(primary))) {
    // First priority centre defaults to the first assigned centre.
    primary = centreIds[0] ?? null;
  }

  const problem = roleCentreProblem(role, centreIds);
  if (problem) throw badRequest(problem);

  // IDs are stored upper-cased and trimmed.
  const normalised: UserPatch = { ...patch };
  if (typeof patch.regNo === "string") normalised.regNo = normaliseId(patch.regNo);
  if (typeof patch.empId === "string") normalised.empId = normaliseId(patch.empId);

  const parsed = userDocSchema.safeParse({
    ...target,
    ...normalised,
    role,
    centreIds,
    primaryCentreId: primary,
  });
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid user data.");
  }
  const next = parsed.data;

  const identityTouched =
    patch.userType !== undefined || patch.regNo !== undefined || patch.empId !== undefined;
  if (identityTouched) {
    const idProblem = identityProblem(next, formats);
    if (idProblem) throw badRequest(idProblem);
  }

  const changes: Record<string, unknown> = {};
  for (const key of TRACKED) {
    if (JSON.stringify(next[key]) !== JSON.stringify(target[key])) changes[key] = next[key];
  }

  return {
    changes,
    changedFields: Object.keys(changes),
    disables: changes.status === "disabled",
    next,
    oldIdKey: idKeyOf(target),
    newIdKey: idKeyOf(next),
  };
}
