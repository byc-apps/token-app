import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { getEnv } from "../lib/env";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { isAllowedEmail } from "../shared/email";
import { isGlobalRole } from "../shared/roles";
import { preRegisteredSchema, type AddStaffBody, type UserWithId } from "../shared/schemas";
import { parseCentre } from "./centres";
import { readAssignee, subjectOf, writeAssignment } from "./assignments";
import { planAdd, planRemove } from "./staff-rules";
import { parseUserDoc } from "./users";

const ROLE_ORDER = { centre_admin: 0, centre_staff: 1 } as const;

export async function listStaff(centreId: string) {
  const db = adminDb();
  const centreSnap = await db.collection("centres").doc(centreId).get();
  if (!centreSnap.exists) throw notFound("Centre not found.");

  const [users, pending] = await Promise.all([
    db.collection("users").where("centreIds", "array-contains", centreId).limit(500).get(),
    db.collection("preregistered").where("centreIds", "array-contains", centreId).limit(500).get(),
  ]);

  const staff = users.docs
    .map((d) => parseUserDoc(d.id, d.data()))
    .map((u) => ({
      uid: u.uid,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      isPrimary: u.primaryCentreId === centreId,
    }))
    .sort(
      (a, b) =>
        (ROLE_ORDER[a.role as keyof typeof ROLE_ORDER] ?? 9) -
          (ROLE_ORDER[b.role as keyof typeof ROLE_ORDER] ?? 9) || a.name.localeCompare(b.name),
    );

  const waiting = pending.docs.map((d) => {
    const parsed = preRegisteredSchema.safeParse(d.data());
    return { email: String(d.data().email ?? d.id), role: parsed.success ? parsed.data.role : "student_faculty" };
  });

  return { staff, pending: waiting };
}

/**
 * Add a person to a centre by exact email.
 * Centre Admin: Centre Staff only. App Admin / Campus Authority: Centre Staff or Centre Admin.
 */
export async function addStaff(
  actor: UserWithId,
  centreId: string,
  body: AddStaffBody,
  requestId: string,
) {
  const db = adminDb();
  const centreRef = db.collection("centres").doc(centreId);

  const result = await db.runTransaction(async (tx) => {
    const centreSnap = await tx.get(centreRef);
    if (!centreSnap.exists) throw notFound("Centre not found.");
    if (!parseCentre(centreId, centreSnap.data()).active) throw badRequest("This centre is not active.");

    const ctx = await readAssignee(tx, body.email);
    const subject = subjectOf(ctx);
    if (subject === null && !isAllowedEmail(body.email, getEnv().allowedDomain)) {
      throw badRequest("Email must be a CHRIST University address.");
    }
    const next = planAdd(actor, subject, body.role, centreId);
    writeAssignment(tx, actor.uid, ctx, next);
    return { pending: ctx.user === null, role: next.role };
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "centre.staff_add",
    targetType: result.pending ? "preregistered" : "user",
    targetId: body.email,
    centreId,
    meta: { role: result.role, pending: result.pending },
    requestId,
  });
  return { email: body.email, role: result.role, pending: result.pending };
}

export async function removeStaff(
  actor: UserWithId,
  centreId: string,
  uid: string,
  requestId: string,
) {
  const db = adminDb();
  const ref = db.collection("users").doc(uid);

  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("User not found.");
    const user = parseUserDoc(uid, snap.data());
    const plan = planRemove(actor, user, centreId, actor.uid === uid);
    tx.update(ref, {
      role: plan.role,
      centreIds: plan.centreIds,
      primaryCentreId: plan.primaryCentreId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return plan;
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "centre.staff_remove",
    targetType: "user",
    targetId: uid,
    centreId,
    meta: { roleAfter: next.role, centresLeft: next.centreIds.length },
    requestId,
  });
}

/** Remove a pending (not yet signed in) person from a centre. */
export async function removePending(
  actor: UserWithId,
  centreId: string,
  email: string,
  requestId: string,
) {
  const db = adminDb();
  const ref = db.collection("preregistered").doc(email);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const parsed = snap.exists ? preRegisteredSchema.safeParse(snap.data()) : null;
    if (!parsed?.success || !parsed.data.centreIds.includes(centreId)) {
      throw notFound("No pending person with that email in this centre.");
    }
    const pre = parsed.data;
    if (!isGlobalRole(actor.role) && pre.role !== "centre_staff") {
      throw forbidden("Only an App Admin or Campus Authority can remove a Centre Admin.");
    }
    const plan = planRemove(actor, pre, centreId, false);
    if (plan.centreIds.length === 0) {
      tx.delete(ref);
    } else {
      tx.update(ref, {
        centreIds: plan.centreIds,
        primaryCentreId: plan.primaryCentreId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "centre.pending_remove",
    targetType: "preregistered",
    targetId: email,
    centreId,
    requestId,
  });
}
