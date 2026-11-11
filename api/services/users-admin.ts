import { FieldPath, FieldValue, type Query } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { getEnv } from "../lib/env";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { isAllowedEmail } from "../shared/email";
import { identityProblem, idKeyOf, normaliseId } from "../shared/ids";
import { isCentreRole } from "../shared/roles";
import {
  preRegisteredSchema,
  roleCentreProblem,
  type PreRegisterBody,
  type UserListQuery,
  type UserPatch,
  type UserWithId,
} from "../shared/schemas";
import { assertActiveDepartment } from "./departments";
import { getIdFormats } from "./settings";
import { parseUserDoc } from "./users";
import { planUserUpdate, removesActiveAdmin } from "./user-rules";

/** Full view for admins (includes contact details). */
export function toAdminUser(u: UserWithId) {
  return {
    uid: u.uid,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    verified: u.verified,
    userType: u.userType,
    centreIds: u.centreIds,
    primaryCentreId: u.primaryCentreId,
    regNo: u.regNo,
    empId: u.empId,
    departmentId: u.departmentId,
    mobile: u.mobile,
  };
}

export async function listUsers(query: UserListQuery) {
  const hasFilter = query.role || query.status || query.verified;
  if (query.q && hasFilter) {
    throw badRequest("Search by email cannot be combined with other filters.");
  }

  let q: Query = adminDb().collection("users");
  if (query.q) {
    const prefix = query.q.toLowerCase();
    q = q
      .where("email", ">=", prefix)
      .where("email", "<=", `${prefix}\uf8ff`)
      .orderBy("email");
  } else {
    if (query.role) q = q.where("role", "==", query.role);
    if (query.status) q = q.where("status", "==", query.status);
    if (query.verified) q = q.where("verified", "==", query.verified === "true");
    q = q.orderBy(FieldPath.documentId());
  }
  if (query.cursor) q = q.startAfter(query.cursor);

  const snap = await q.limit(query.limit + 1).get();
  const page = snap.docs.slice(0, query.limit);
  const users = page.map((d) => toAdminUser(parseUserDoc(d.id, d.data())));
  const last = page[page.length - 1];
  const hasMore = snap.docs.length > query.limit;
  const nextCursor = hasMore && last ? (query.q ? String(last.get("email")) : last.id) : null;
  return { users, nextCursor };
}

export async function getUserForAdmin(uid: string) {
  const snap = await adminDb().collection("users").doc(uid).get();
  if (!snap.exists) throw notFound("User not found.");
  return toAdminUser(parseUserDoc(uid, snap.data()));
}

export async function listPreRegistered() {
  const snap = await adminDb().collection("preregistered").orderBy("email").limit(200).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      email: String(x.email ?? d.id),
      name: x.name ?? null,
      role: x.role,
      userType: x.userType ?? null,
      centreIds: x.centreIds ?? [],
      primaryCentreId: x.primaryCentreId ?? null,
      departmentId: x.departmentId ?? null,
    };
  });
}

/** Admin adds someone before their first sign-in. Merged into users/{uid} on first login. */
export async function preRegisterUser(actor: UserWithId, body: PreRegisterBody, requestId: string) {
  if (!isAllowedEmail(body.email, getEnv().allowedDomain)) {
    throw badRequest("Email must be a CHRIST University address.");
  }
  if (body.role === "app_admin" && actor.role !== "app_admin") {
    throw forbidden("Only an App Admin can grant the App Admin role.");
  }
  const problem = roleCentreProblem(body.role, body.centreIds);
  if (problem) throw badRequest(problem);

  const regNo = body.regNo === null ? null : normaliseId(body.regNo);
  const empId = body.empId === null ? null : normaliseId(body.empId);
  const idProblem = identityProblem(
    { userType: body.userType, regNo, empId },
    await getIdFormats(),
  );
  if (idProblem) throw badRequest(idProblem);

  const primary = isCentreRole(body.role)
    ? (body.primaryCentreId ?? body.centreIds[0] ?? null)
    : null;
  const parsed = preRegisteredSchema.safeParse({ ...body, regNo, empId, primaryCentreId: primary });
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid data.");

  const db = adminDb();
  const preRef = db.collection("preregistered").doc(body.email);
  const idKey = idKeyOf({ userType: body.userType, regNo, empId });

  await db.runTransaction(async (tx) => {
    // ---- reads ----
    const [existingUser, existingPre] = await Promise.all([
      tx.get(db.collection("users").where("email", "==", body.email).limit(1)),
      tx.get(preRef),
    ]);
    if (!existingUser.empty) throw conflict("This person has already signed in. Edit their user record instead.");
    if (existingPre.exists) throw conflict("This email is already pre-registered.");

    if (idKey && (await tx.get(db.collection("idLinks").doc(idKey))).exists) {
      throw conflict("This ID is already linked to another account.");
    }
    if (body.centreIds.length > 0) {
      const snaps = await tx.getAll(...body.centreIds.map((id) => db.collection("centres").doc(id)));
      const bad = snaps.filter((s) => !s.exists || s.data()?.active !== true).map((s) => s.id);
      if (bad.length > 0) throw badRequest(`Unknown or inactive centre: ${bad.join(", ")}`);
    }
    if (body.departmentId) await assertActiveDepartment(tx, body.departmentId);

    // ---- write ----
    tx.create(preRef, {
      ...parsed.data,
      email: body.email,
      createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "user.preregister",
    targetType: "preregistered",
    targetId: body.email,
    meta: { role: parsed.data.role },
    requestId,
  });
  return { email: body.email, role: parsed.data.role };
}

export async function updateUser(
  actor: UserWithId,
  uid: string,
  patch: UserPatch,
  requestId: string,
) {
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  const formats = await getIdFormats();

  const { target, plan, user } = await db.runTransaction(async (tx) => {
    // ---- all reads first ----
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("User not found.");
    const current = parseUserDoc(uid, snap.data());

    let otherActiveAdmins = 0;
    if (removesActiveAdmin(current, patch)) {
      const admins = await tx.get(
        db.collection("users").where("role", "==", "app_admin").where("status", "==", "active"),
      );
      otherActiveAdmins = admins.docs.filter((d) => d.id !== uid).length;
    }

    const planned = planUserUpdate(actor, current, patch, otherActiveAdmins, formats);

    const nextCentres = (planned.changes.centreIds as string[] | undefined) ?? current.centreIds;
    const added = nextCentres.filter((id) => !current.centreIds.includes(id));
    if (added.length > 0) {
      const snaps = await tx.getAll(...added.map((id) => db.collection("centres").doc(id)));
      const bad = snaps.filter((s) => !s.exists || s.data()?.active !== true).map((s) => s.id);
      if (bad.length > 0) throw badRequest(`Unknown or inactive centre: ${bad.join(", ")}`);
    }
    if (typeof planned.changes.departmentId === "string") {
      await assertActiveDepartment(tx, planned.changes.departmentId);
    }

    // The ID index (idLinks) must always match the user's ID.
    const keysDiffer = planned.oldIdKey !== planned.newIdKey;
    const newLinkRef = planned.newIdKey ? db.collection("idLinks").doc(planned.newIdKey) : null;
    const oldLinkRef = planned.oldIdKey ? db.collection("idLinks").doc(planned.oldIdKey) : null;
    const newLinkSnap = keysDiffer && newLinkRef ? await tx.get(newLinkRef) : null;
    const oldLinkSnap = keysDiffer && oldLinkRef ? await tx.get(oldLinkRef) : null;
    if (newLinkSnap?.exists && newLinkSnap.data()?.uid !== uid) {
      throw conflict("This ID is already linked to another account.");
    }

    // ---- then the writes ----
    if (planned.changedFields.length === 0) {
      return { target: current, plan: planned, user: current };
    }
    tx.update(ref, { ...planned.changes, updatedAt: FieldValue.serverTimestamp() });
    if (keysDiffer) {
      if (newLinkRef && !newLinkSnap?.exists) {
        tx.set(newLinkRef, {
          uid,
          userType: planned.next.userType,
          email: current.email,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      if (oldLinkRef && oldLinkSnap?.exists && oldLinkSnap.data()?.uid === uid) {
        tx.delete(oldLinkRef);
      }
    }
    return {
      target: current,
      plan: planned,
      user: parseUserDoc(uid, { ...current, ...planned.changes }),
    };
  });

  if (plan.changedFields.length === 0) return toAdminUser(user);

  // A disabled user is cut off immediately: refresh tokens are revoked and every request
  // also re-checks status in Firestore.
  if (plan.disables) {
    try {
      await adminAuth().revokeRefreshTokens(uid);
    } catch {
      console.error("revoke_tokens_failed", { uid, requestId });
    }
  }

  const meta: Record<string, string | number | boolean | null> = {
    fields: plan.changedFields.join(","),
  };
  if (plan.changes.role !== undefined) {
    meta.roleFrom = target.role;
    meta.roleTo = user.role;
  }
  if (plan.changes.status !== undefined) meta.statusTo = user.status;
  await writeAudit({
    actorUid: actor.uid,
    action: "user.update",
    targetType: "user",
    targetId: uid,
    meta,
    requestId,
  });

  return toAdminUser(user);
}
