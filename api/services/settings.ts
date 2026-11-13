import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { DEFAULT_ID_FORMATS, type IdFormats } from "../shared/ids";
import {
  bookingSettingsSchema,
  settingsDocSchema,
  type BookingSettings,
  type SettingsPatch,
  type UserWithId,
} from "../shared/schemas";

const settingsRef = () => adminDb().collection("settings").doc("app");

export interface AppSettings {
  idFormats: IdFormats;
  booking: BookingSettings;
}

/** Falls back to the defaults until an admin saves their own values. */
export async function getSettings(): Promise<AppSettings> {
  const snap = await settingsRef().get();
  const parsed = snap.exists ? settingsDocSchema.safeParse(snap.data()) : null;
  if (parsed?.success) return parsed.data;
  return { idFormats: DEFAULT_ID_FORMATS, booking: bookingSettingsSchema.parse({}) };
}

export async function getIdFormats(): Promise<IdFormats> {
  return (await getSettings()).idFormats;
}

export async function getBookingSettings(): Promise<BookingSettings> {
  return (await getSettings()).booking;
}

/** Changing a rule does not change tokens that already exist. */
export async function updateSettings(actor: UserWithId, patch: SettingsPatch, requestId: string) {
  const current = await getSettings();
  const next: AppSettings = {
    idFormats: {
      student: patch.idFormats?.student ?? current.idFormats.student,
      faculty: patch.idFormats?.faculty ?? current.idFormats.faculty,
    },
    booking: { ...current.booking, ...(patch.booking ?? {}) },
  };
  await settingsRef().set({
    ...next,
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit({
    actorUid: actor.uid,
    action: "settings.update",
    targetType: "settings",
    targetId: "app",
    meta: { fields: [...Object.keys(patch.idFormats ?? {}), ...Object.keys(patch.booking ?? {})].join(",") },
    requestId,
  });
  return next;
}
