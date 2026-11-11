import { FieldValue, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { conflict } from "../lib/errors";
import { preRegisteredSchema, type PreRegistered, type UserWithId } from "../shared/schemas";
import { parseUserDoc } from "./users";
import type { Assignment, Subject } from "./staff-rules";

/**
 * Who an email address refers to right now: a signed-in user, a pre-registration,
 * or nobody yet. Reading is split from writing because Firestore transactions
 * need every read to happen before the first write.
 */
export interface AssigneeCtx {
  email: string;
  user: { ref: DocumentReference; data: UserWithId } | null;
  pre: { ref: DocumentReference; data: PreRegistered } | null;
  preRef: DocumentReference;
}

export async function readAssignee(tx: Transaction, email: string): Promise<AssigneeCtx> {
  const db = adminDb();
  const preRef = db.collection("preregistered").doc(email);
  const [userSnap, preSnap] = await Promise.all([
    tx.get(db.collection("users").where("email", "==", email).limit(1)),
    tx.get(preRef),
  ]);

  const userDoc = userSnap.docs[0];
  const user = userDoc
    ? { ref: userDoc.ref, data: parseUserDoc(userDoc.id, userDoc.data()) }
    : null;

  let pre: AssigneeCtx["pre"] = null;
  if (preSnap.exists) {
    const parsed = preRegisteredSchema.safeParse(preSnap.data());
    if (!parsed.success) {
      throw conflict("This email has a damaged pre-registration. An App Admin should remove it first.");
    }
    pre = { ref: preRef, data: parsed.data };
  }
  return { email, user, pre, preRef };
}

export function subjectOf(ctx: AssigneeCtx): Subject | null {
  if (ctx.user) return ctx.user.data;
  if (ctx.pre) return ctx.pre.data;
  return null;
}

export function writeAssignment(
  tx: Transaction,
  actorUid: string,
  ctx: AssigneeCtx,
  next: Assignment,
): void {
  const fields = {
    role: next.role,
    centreIds: next.centreIds,
    primaryCentreId: next.primaryCentreId,
  };
  if (ctx.user) {
    tx.update(ctx.user.ref, { ...fields, updatedAt: FieldValue.serverTimestamp() });
  } else if (ctx.pre) {
    tx.update(ctx.preRef, { ...fields, updatedAt: FieldValue.serverTimestamp() });
  } else {
    tx.create(ctx.preRef, {
      ...fields,
      email: ctx.email,
      userType: null,
      regNo: null,
      empId: null,
      departmentId: null,
      mobile: null,
      createdBy: actorUid,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
