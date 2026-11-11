import { conflict, forbidden, notFound } from "../lib/errors";
import { isGlobalRole, type Role } from "../shared/roles";
import type { UserWithId } from "../shared/schemas";

/**
 * Pure rules for adding/removing people to a centre.
 * NOTE: a role applies to ALL of a person's centres (role + centreIds model).
 */
export interface Subject {
  role: Role;
  centreIds: string[];
  primaryCentreId: string | null;
  status?: "active" | "disabled";
}
export interface Assignment {
  role: Role;
  centreIds: string[];
  primaryCentreId: string | null;
}

export type StaffRole = "centre_staff" | "centre_admin";

/** `subject` is null when the person has never been seen (becomes a pre-registration). */
export function planAdd(
  actor: UserWithId,
  subject: Subject | null,
  desired: StaffRole,
  centreId: string,
): Assignment {
  const actorIsGlobal = isGlobalRole(actor.role);
  if (desired === "centre_admin" && !actorIsGlobal) {
    throw forbidden("Only an App Admin or Campus Authority can add a Centre Admin.");
  }
  if (subject === null) {
    return { role: desired, centreIds: [centreId], primaryCentreId: centreId };
  }
  if (subject.status === "disabled") {
    throw conflict("This account is disabled. An App Admin must enable it first.");
  }
  if (isGlobalRole(subject.role)) {
    throw conflict("This person already has access to every centre.");
  }
  if (subject.centreIds.includes(centreId)) {
    throw conflict("This person is already assigned to this centre.");
  }
  if (subject.role === "centre_admin" && desired === "centre_staff") {
    if (!actorIsGlobal) {
      throw forbidden("This person is a Centre Admin elsewhere. Ask an App Admin to add them.");
    }
    throw conflict("This person is a Centre Admin. Add them with the Centre Admin role instead.");
  }
  // A role covers all of a person's centres, so an existing Centre Admin stays one.
  const role: Role = subject.role === "centre_admin" ? "centre_admin" : desired;
  return {
    role,
    centreIds: [...subject.centreIds, centreId],
    primaryCentreId: subject.primaryCentreId ?? centreId,
  };
}

export function planRemove(
  actor: UserWithId,
  subject: Subject,
  centreId: string,
  isSelf: boolean,
): Assignment {
  if (!subject.centreIds.includes(centreId)) throw notFound("This person is not in this centre.");
  const actorIsGlobal = isGlobalRole(actor.role);
  if (isSelf && !actorIsGlobal) throw forbidden("You cannot remove yourself from a centre.");
  if (!actorIsGlobal && subject.role !== "centre_staff") {
    throw forbidden("Only an App Admin or Campus Authority can remove a Centre Admin.");
  }
  const centreIds = subject.centreIds.filter((id) => id !== centreId);
  if (centreIds.length === 0) {
    return { role: "student_faculty", centreIds: [], primaryCentreId: null };
  }
  const primary =
    subject.primaryCentreId === centreId || subject.primaryCentreId === null
      ? centreIds[0]
      : subject.primaryCentreId;
  return { role: subject.role, centreIds, primaryCentreId: primary };
}
