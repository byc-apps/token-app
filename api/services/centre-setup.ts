import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { badRequest, conflict, notFound } from "../lib/errors";
import { hasPermission } from "../shared/roles";
import { DAY_KEYS, bookableSlots, generateSlots, slotEnd, slotKey } from "../shared/slots";
import {
  centreConfigSchema,
  type CentreWithId,
  type SlotDayBody,
  type UpdateConfigBody,
  type UserWithId,
} from "../shared/schemas";
import { addDays, istDateKey, istDateTime, istWeekday } from "../shared/time";
import { snapshotSchema } from "../shared/queue";
import { parseCentre } from "./centres";
import { readSlotDay, slotDayId } from "./slot-days";
import { getBookingSettings } from "./settings";

const centreRef = (id: string) => adminDb().collection("centres").doc(id);

export async function getCentreDoc(id: string): Promise<CentreWithId> {
  const snap = await centreRef(id).get();
  if (!snap.exists) throw notFound("Centre not found.");
  return parseCentre(id, snap.data());
}

/* ------------------------------ config ------------------------------ */

export async function getConfig(centreId: string) {
  const c = await getCentreDoc(centreId);
  return { config: c.config, services: c.services, counters: c.counters };
}

export async function updateConfig(
  actor: UserWithId,
  centreId: string,
  patch: UpdateConfigBody,
  requestId: string,
) {
  const db = adminDb();
  const ref = centreRef(centreId);
  const config = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("Centre not found.");
    const current = parseCentre(centreId, snap.data());
    const { hours, ...rest } = patch;
    const merged = {
      ...current.config,
      ...rest,
      hours: { ...current.config.hours, ...(hours ?? {}) },
    };
    const parsed = centreConfigSchema.safeParse(merged);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid settings.");
    tx.update(ref, { config: parsed.data, updatedAt: FieldValue.serverTimestamp() });
    return parsed.data;
  });
  await writeAudit({
    actorUid: actor.uid,
    action: "centre.config_update",
    targetType: "centre",
    targetId: centreId,
    centreId,
    meta: { fields: Object.keys(patch).join(",") },
    requestId,
  });
  return { config };
}

/* ------------------------ services and counters ---------------------- */

type ListKind = "services" | "counters";
const LIMIT: Record<ListKind, number> = { services: 50, counters: 20 };
const newId = () => randomUUID().replace(/-/g, "").slice(0, 10);

export async function addListItem(
  kind: ListKind,
  actor: UserWithId,
  centreId: string,
  name: string,
  requestId: string,
) {
  const db = adminDb();
  const ref = centreRef(centreId);
  const item = { id: newId(), name, active: true };
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("Centre not found.");
    const list = parseCentre(centreId, snap.data())[kind];
    if (list.length >= LIMIT[kind]) throw conflict(`A centre can have at most ${LIMIT[kind]} ${kind}.`);
    if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      throw conflict("An item with this name already exists.");
    }
    tx.update(ref, { [kind]: [...list, item], updatedAt: FieldValue.serverTimestamp() });
  });
  await writeAudit({
    actorUid: actor.uid,
    action: `centre.${kind}_add`,
    targetType: "centre",
    targetId: centreId,
    centreId,
    meta: { itemId: item.id },
    requestId,
  });
  return item;
}

export async function updateListItem(
  kind: ListKind,
  actor: UserWithId,
  centreId: string,
  itemId: string,
  patch: { name?: string; active?: boolean },
  requestId: string,
) {
  const db = adminDb();
  const ref = centreRef(centreId);
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("Centre not found.");
    const list = parseCentre(centreId, snap.data())[kind];
    const current = list.find((x) => x.id === itemId);
    if (!current) throw notFound("Item not found.");

    if (kind === "counters" && patch.active === false) {
      const qs = await tx.get(db.collection("queueSnapshots").doc(centreId));
      const parsed = qs.exists ? snapshotSchema.safeParse(qs.data()) : null;
      if (parsed?.success && parsed.data.serving.some((s) => s.counterId === itemId)) {
        throw conflict("This counter is serving a token. Close the token first.");
      }
    }
    if (patch.name && list.some((x) => x.id !== itemId && x.name.toLowerCase() === patch.name?.toLowerCase())) {
      throw conflict("An item with this name already exists.");
    }
    const next = { ...current, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.active !== undefined ? { active: patch.active } : {}) };
    tx.update(ref, {
      [kind]: list.map((x) => (x.id === itemId ? next : x)),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return next;
  });
  await writeAudit({
    actorUid: actor.uid,
    action: `centre.${kind}_update`,
    targetType: "centre",
    targetId: centreId,
    centreId,
    meta: { itemId, fields: Object.keys(patch).join(",") },
    requestId,
  });
  return updated;
}

/* ------------------------------- slots ------------------------------- */

export type SlotState = "available" | "few" | "full" | "blocked" | "past";

export interface SlotView {
  start: string;
  end: string;
  booked: number;
  remaining: number;
  state: SlotState;
}

/** Pure: build the slot list for one centre and one date. */
export function buildSlotViews(
  centre: CentreWithId,
  date: string,
  day: ReturnType<typeof readSlotDay>,
  nowMs: number,
): { closed: boolean; slots: SlotView[] } {
  const dayCfg = centre.config.hours[DAY_KEYS[istWeekday(date)]];
  if (!dayCfg || day.closed) return { closed: true, slots: [] };
  const capacity = centre.config.slotCapacity;
  const slots = generateSlots(dayCfg, day.blocked).map((s): SlotView => {
    const booked = day.counts[slotKey(s.start)] ?? 0;
    const remaining = Math.max(0, capacity - booked);
    let state: SlotState = remaining === 0 ? "full" : remaining <= 2 ? "few" : "available";
    if (istDateTime(date, s.start).getTime() <= nowMs) state = "past";
    if (s.blocked) state = "blocked";
    return { start: s.start, end: slotEnd(s.start), booked, remaining, state };
  });
  return { closed: false, slots };
}

export async function getSlots(viewer: UserWithId, centreId: string, date: string) {
  const db = adminDb();
  const [centreSnap, daySnap] = await Promise.all([
    centreRef(centreId).get(),
    db.collection("slotDays").doc(slotDayId(centreId, date)).get(),
  ]);
  if (!centreSnap.exists) throw notFound("Centre not found.");
  const centre = parseCentre(centreId, centreSnap.data());
  const now = Date.now();

  if (viewer.role === "student_faculty") {
    if (!centre.active) throw notFound("Centre not found.");
    const { windowDays } = await getBookingSettings();
    const today = istDateKey(new Date(now));
    if (date < today || date > addDays(today, windowDays)) {
      throw badRequest(`You can see slots from today up to ${windowDays} days ahead.`);
    }
  }
  const day = readSlotDay(daySnap.data());
  const built = buildSlotViews(centre, date, day, now);
  return {
    centreId,
    date,
    capacity: centre.config.slotCapacity,
    closed: built.closed,
    note: day.note,
    slots: built.slots,
  };
}

/** Close a whole day (holiday) or block some slots on one date ("no service"). */
export async function setSlotDay(
  actor: UserWithId,
  centreId: string,
  date: string,
  body: SlotDayBody,
  requestId: string,
) {
  if (date < istDateKey()) throw badRequest("You cannot change a past date.");
  const db = adminDb();
  const ref = db.collection("slotDays").doc(slotDayId(centreId, date));

  await db.runTransaction(async (tx) => {
    const [centreSnap, daySnap] = await Promise.all([tx.get(centreRef(centreId)), tx.get(ref)]);
    if (!centreSnap.exists) throw notFound("Centre not found.");
    const centre = parseCentre(centreId, centreSnap.data());
    const day = readSlotDay(daySnap.data());

    const blocked = body.blocked ?? day.blocked;
    const closed = body.closed ?? day.closed;
    const valid = new Set(bookableSlots(centre.config.hours[DAY_KEYS[istWeekday(date)]]));
    for (const b of blocked) {
      if (!valid.has(b)) throw badRequest(`${b} is not a slot on this day.`);
      if ((day.counts[slotKey(b)] ?? 0) > 0) {
        throw conflict(`Slot ${b} already has bookings. Cancel or move them first.`);
      }
    }
    if (closed && Object.values(day.counts).some((n) => n > 0)) {
      throw conflict("This day already has bookings. Cancel or move them first.");
    }
    tx.set(
      ref,
      {
        centreId,
        date,
        blocked,
        closed,
        note: body.note !== undefined ? body.note : day.note,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "centre.slot_day_update",
    targetType: "centre",
    targetId: centreId,
    centreId,
    meta: { date, closed: body.closed ?? null, blocked: body.blocked ? body.blocked.length : null },
    requestId,
  });
  return getSlots(actor, centreId, date);
}

export const canSeeAllSlots = (u: UserWithId) => hasPermission(u.role, "centre:configure");
