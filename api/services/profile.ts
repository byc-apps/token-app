import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { AppError, badRequest, forbidden, notFound } from "../lib/errors";
import { checkId, idLinkKey, isProfileComplete, userIdValue } from "../shared/ids";
import type { ProfileBody, UserWithId } from "../shared/schemas";
import { assertActiveDepartment } from "./departments";
import { getIdFormats } from "./settings";
import { parseUserDoc } from "./users";

/**
 * "Complete your profile". Type, ID and department can be set once and are then
 * locked (only an admin can change them). Mobile stays editable via updateMobile.
 */
export async function completeProfile(user: UserWithId, body: ProfileBody, requestId: string) {
  const formats = await getIdFormats();
  const checked = checkId(body.userType, body.id, formats);
  if (!checked.ok) throw badRequest(checked.message);

  const db = adminDb();
  const idField = body.userType === "student" ? "regNo" : "empId";
  const userRef = db.collection("users").doc(user.uid);
  const linkRef = db.collection("idLinks").doc(idLinkKey(body.userType, checked.id));

  const { wasComplete, updated } = await db.runTransaction(async (tx) => {
    // ---- reads ----
    const [userSnap, linkSnap] = await Promise.all([tx.get(userRef), tx.get(linkRef)]);
    if (!userSnap.exists) throw notFound("User not found.");
    const current = parseUserDoc(user.uid, userSnap.data());

    if (current.userType !== null && current.userType !== body.userType) {
      throw forbidden("Your account type is locked. Contact the App Admin to change it.");
    }
    const currentId = userIdValue(current);
    if (currentId !== null && currentId !== checked.id) {
      throw forbidden("Your ID is locked. Contact the App Admin to change it.");
    }
    if (current.departmentId !== null && current.departmentId !== body.departmentId) {
      throw forbidden("Your department is locked. Contact the App Admin to change it.");
    }
    if (current.departmentId !== body.departmentId) {
      await assertActiveDepartment(tx, body.departmentId);
    }
    if (linkSnap.exists && linkSnap.data()?.uid !== user.uid) {
      throw new AppError(
        409,
        "ID_ALREADY_LINKED",
        "This ID is already linked to another account. If this is a mistake, contact the App Admin.",
      );
    }

    // ---- writes ----
    tx.update(userRef, {
      userType: body.userType,
      [idField]: checked.id,
      departmentId: body.departmentId,
      mobile: body.mobile,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (!linkSnap.exists) {
      tx.set(linkRef, {
        uid: user.uid,
        userType: body.userType,
        email: current.email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return {
      wasComplete: isProfileComplete(current),
      updated: parseUserDoc(user.uid, {
        ...current,
        userType: body.userType,
        [idField]: checked.id,
        departmentId: body.departmentId,
        mobile: body.mobile,
      }),
    };
  });

  if (!wasComplete) {
    await writeAudit({
      actorUid: user.uid,
      action: "user.profile_complete",
      targetType: "user",
      targetId: user.uid,
      meta: { userType: body.userType },
      requestId,
    });
  }
  return updated;
}

export async function updateMobile(user: UserWithId, mobile: string): Promise<UserWithId> {
  await adminDb()
    .collection("users")
    .doc(user.uid)
    .update({ mobile, updatedAt: FieldValue.serverTimestamp() });
  return { ...user, mobile };
}
