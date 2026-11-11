import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { getEnv } from "../lib/env";
import { badRequest, conflict, notFound } from "../lib/errors";
import { isAllowedEmail } from "../shared/email";
import { centreIdFor } from "../shared/centres";
import { hasPermission } from "../shared/roles";
import {
  centreDocSchema,
  type CreateDepartmentBody,
  type UpdateDepartmentBody,
  type UserWithId,
} from "../shared/schemas";
import { parseCentre, updateCentre } from "./centres";
import { readAssignee, subjectOf, writeAssignment } from "./assignments";
import { planAdd } from "./staff-rules";

/** Throws unless `id` is an active department desk. Call before any write in a transaction. */
export async function assertActiveDepartment(tx: Transaction, id: string): Promise<void> {
  const snap = await tx.get(adminDb().collection("centres").doc(id));
  const parsed = snap.exists ? centreDocSchema.safeParse(snap.data()) : null;
  if (!parsed?.success || parsed.data.kind !== "department" || !parsed.data.active) {
    throw badRequest("Unknown or inactive department.");
  }
}

/** Active departments for everyone (profile dropdown); managers also see inactive ones. */
export async function listDepartments(viewer: UserWithId) {
  const manager = hasPermission(viewer.role, "centres:manage");
  let q = adminDb().collection("centres").where("kind", "==", "department");
  if (!manager) q = q.where("active", "==", true);
  const snap = await q.get();
  return snap.docs
    .map((d) => parseCentre(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      tokenPrefix: c.tokenPrefix,
      ...(manager ? { active: c.active } : {}),
    }));
}

/**
 * Creates a department desk. If a secretary email is given, that person becomes
 * Centre Admin of the desk (existing user, pending pre-registration, or a new one).
 */
export async function createDepartment(
  actor: UserWithId,
  body: CreateDepartmentBody,
  requestId: string,
) {
  const db = adminDb();
  const id = centreIdFor("department", body.code);
  const ref = db.collection("centres").doc(id);

  if (body.secretaryEmail && !isAllowedEmail(body.secretaryEmail, getEnv().allowedDomain)) {
    throw badRequest("Secretary email must be a CHRIST University address.");
  }

  const secretary = await db.runTransaction(async (tx) => {
    // ---- reads ----
    if ((await tx.get(ref)).exists) throw conflict(`Department ${body.code} already exists.`);
    const ctx = body.secretaryEmail ? await readAssignee(tx, body.secretaryEmail) : null;
    const plan = ctx ? planAdd(actor, subjectOf(ctx), "centre_admin", id) : null;

    // ---- writes ----
    tx.create(ref, {
      name: body.name,
      code: body.code,
      kind: "department",
      confidential: false,
      location: null,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (ctx && plan) writeAssignment(tx, actor.uid, ctx, plan);
    return ctx ? { email: ctx.email, signedUp: ctx.user !== null } : null;
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "department.create",
    targetType: "centre",
    targetId: id,
    centreId: id,
    meta: { code: body.code, secretary: secretary?.email ?? null },
    requestId,
  });

  const snap = await ref.get();
  return { department: parseCentre(id, snap.data()), secretary };
}

export async function updateDepartment(
  actor: UserWithId,
  id: string,
  patch: UpdateDepartmentBody,
  requestId: string,
) {
  const snap = await adminDb().collection("centres").doc(id).get();
  if (!snap.exists || parseCentre(id, snap.data()).kind !== "department") {
    throw notFound("Department not found.");
  }
  return updateCentre(actor, id, patch, requestId);
}
