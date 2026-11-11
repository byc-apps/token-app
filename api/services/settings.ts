import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { DEFAULT_ID_FORMATS, type IdFormats } from "../shared/ids";
import { settingsDocSchema, type SettingsPatch, type UserWithId } from "../shared/schemas";

const settingsRef = () => adminDb().collection("settings").doc("app");

/** Falls back to the defaults until an admin saves their own formats. */
export async function getIdFormats(): Promise<IdFormats> {
  const snap = await settingsRef().get();
  const parsed = snap.exists ? settingsDocSchema.safeParse(snap.data()) : null;
  return parsed?.success ? parsed.data.idFormats : DEFAULT_ID_FORMATS;
}

/** Changing a format does not invalidate IDs that already exist. */
export async function updateIdFormats(actor: UserWithId, patch: SettingsPatch, requestId: string) {
  const current = await getIdFormats();
  const idFormats: IdFormats = {
    student: patch.idFormats.student ?? current.student,
    faculty: patch.idFormats.faculty ?? current.faculty,
  };
  await settingsRef().set({
    idFormats,
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit({
    actorUid: actor.uid,
    action: "settings.update",
    targetType: "settings",
    targetId: "app",
    meta: { fields: Object.keys(patch.idFormats).join(",") },
    requestId,
  });
  return { idFormats };
}
