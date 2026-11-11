import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { getEnv } from "../lib/env";
import { AppError } from "../lib/errors";
import { idKeyOf, isProfileComplete } from "../shared/ids";
import {
  preRegisteredSchema,
  userDocSchema,
  type UserDoc,
  type UserWithId,
} from "../shared/schemas";

export function parseUserDoc(uid: string, data: unknown): UserWithId {
  const parsed = userDocSchema.safeParse(data);
  if (!parsed.success) {
    console.error("user_record_invalid", { uid });
    throw new AppError(500, "USER_RECORD_INVALID", "Your account record needs attention. Contact the App Admin.");
  }
  return { uid, ...parsed.data };
}

export async function getUserById(uid: string): Promise<UserWithId | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.exists ? parseUserDoc(uid, snap.data()) : null;
}

/**
 * First sign-in: create `users/{uid}`.
 *  - email in BOOTSTRAP_ADMIN_EMAILS  -> app_admin (only at creation time)
 *  - admin pre-registered the email   -> use that record, then delete it
 *  - anyone else with a valid CHRIST email -> student_faculty, unverified
 * Runs in a transaction so two parallel first logins cannot create duplicates.
 */
export async function loginOrRegister(
  decoded: DecodedIdToken,
): Promise<{ user: UserWithId; created: boolean }> {
  const db = adminDb();
  const email = (decoded.email ?? "").toLowerCase();
  const userRef = db.collection("users").doc(decoded.uid);
  const preRef = db.collection("preregistered").doc(email);

  return db.runTransaction(async (tx) => {
    const [userSnap, preSnap] = await Promise.all([tx.get(userRef), tx.get(preRef)]);
    if (userSnap.exists) {
      return { user: parseUserDoc(decoded.uid, userSnap.data()), created: false };
    }

    const pre = preSnap.exists ? preRegisteredSchema.safeParse(preSnap.data()) : null;
    const preData = pre?.success ? pre.data : null;
    const isBootstrapAdmin = getEnv().bootstrapAdmins.includes(email);

    // An admin-entered ID is linked to this account unless someone else claimed it meanwhile.
    let identity = {
      userType: preData?.userType ?? null,
      regNo: preData?.regNo ?? null,
      empId: preData?.empId ?? null,
    };
    const idKey = idKeyOf(identity);
    let linkRef = null;
    if (idKey) {
      linkRef = db.collection("idLinks").doc(idKey);
      const linkSnap = await tx.get(linkRef);
      if (linkSnap.exists) {
        identity = { userType: null, regNo: null, empId: null };
        linkRef = null;
      }
    }

    const candidate: UserDoc = userDocSchema.parse({
      email,
      name: (preData?.name ?? decoded.name ?? email.split("@")[0]).slice(0, 200),
      role: isBootstrapAdmin ? "app_admin" : (preData?.role ?? "student_faculty"),
      status: "active",
      // Admin-added and bootstrap accounts are trusted; self-registered ones wait in the "Unverified" list.
      verified: isBootstrapAdmin || preData !== null,
      ...identity,
      centreIds: preData?.centreIds ?? [],
      primaryCentreId: preData?.primaryCentreId ?? null,
      departmentId: preData?.departmentId ?? null,
      mobile: preData?.mobile ?? null,
    });

    tx.set(userRef, {
      ...candidate,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (linkRef) {
      tx.set(linkRef, {
        uid: decoded.uid,
        userType: candidate.userType,
        email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (preSnap.exists) tx.delete(preRef);

    return { user: { uid: decoded.uid, ...candidate }, created: true };
  });
}

/** What the signed-in user is allowed to see about themselves. */
export function toPublicUser(u: UserWithId) {
  return {
    uid: u.uid,
    email: u.email,
    name: u.name,
    role: u.role,
    userType: u.userType,
    regNo: u.regNo,
    empId: u.empId,
    departmentId: u.departmentId,
    mobile: u.mobile,
    centreIds: u.centreIds,
    primaryCentreId: u.primaryCentreId,
    status: u.status,
    profileComplete: isProfileComplete(u),
  };
}
