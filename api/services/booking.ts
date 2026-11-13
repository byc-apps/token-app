import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { AppError, badRequest, conflict, notFound } from "../lib/errors";
import { assertTokenAccess } from "../middleware/guard";
import { dequeue, estimateTimes } from "../shared/queue";
import { isProfileComplete, userIdValue } from "../shared/ids";
import { DAY_KEYS, bookableSlots, slotKey } from "../shared/slots";
import type { BookTokenBody, ModifyTokenBody, UserWithId } from "../shared/schemas";
import { addDays, istDateKey, istDateTime, istWeekday } from "../shared/time";
import {
  ACTIVE_STATUSES,
  canCancelByUser,
  effectiveStatus,
  formatTokenNumber,
  type TokenDoc,
} from "../shared/tokens";
import { tokenPrefixFor } from "../shared/centres";
import { getCentreDoc } from "./centre-setup";
import { parseCentre } from "./centres";
import { notifyToken } from "./emails";
import { getBookingSettings } from "./settings";
import { readSlotDay, slotDayId } from "./slot-days";
import {
  parseToken,
  readSnapshot,
  readSnapshotTx,
  resolveService,
  snapRef,
  toStaffView,
  toStudentView,
  tokensCol,
} from "./token-common";

const centreRef = (id: string) => adminDb().collection("centres").doc(id);
const slotDayRef = (centreId: string, date: string) =>
  adminDb().collection("slotDays").doc(slotDayId(centreId, date));

/* ------------------------------ booking ------------------------------ */

export async function createBooking(user: UserWithId, body: BookTokenBody, requestId: string) {
  if (!isProfileComplete(user)) {
    throw new AppError(403, "PROFILE_INCOMPLETE", "Complete your profile before booking.");
  }
  const settings = await getBookingSettings();
  const now = Date.now();
  const today = istDateKey(new Date(now));
  if (body.date < today || body.date > addDays(today, settings.windowDays)) {
    throw badRequest(`You can book from today up to ${settings.windowDays} days ahead.`);
  }

  const db = adminDb();
  const dayRef = slotDayRef(body.centreId, body.date);
  const seqRef = db.collection("tokenSeq").doc(`${body.centreId}_${body.date}`);
  const tokenRef = tokensCol().doc();
  const key = slotKey(body.slot);

  const token = await db.runTransaction(async (tx) => {
    // ---- reads ----
    const [centreSnap, daySnap, seqSnap, mine] = await Promise.all([
      tx.get(centreRef(body.centreId)),
      tx.get(dayRef),
      tx.get(seqRef),
      tx.get(
        tokensCol()
          .where("userId", "==", user.uid)
          .where("centreId", "==", body.centreId)
          .where("date", "==", body.date),
      ),
    ]);
    if (!centreSnap.exists) throw notFound("Centre not found.");
    const centre = parseCentre(body.centreId, centreSnap.data());
    if (!centre.active) throw badRequest("This centre is not taking bookings.");
    const service = resolveService(centre, body);

    const day = readSlotDay(daySnap.data());
    const hours = centre.config.hours[DAY_KEYS[istWeekday(body.date)]];
    if (day.closed || !bookableSlots(hours, day.blocked).includes(body.slot)) {
      throw badRequest("This slot is not available.");
    }
    if (istDateTime(body.date, body.slot).getTime() <= now) {
      throw badRequest("This slot has already started.");
    }
    if ((day.counts[key] ?? 0) >= centre.config.slotCapacity) {
      throw new AppError(409, "SLOT_FULL", "This slot is full. Please choose another.");
    }
    const active = mine.docs.filter((d) => ACTIVE_STATUSES.includes(d.data().status)).length;
    if (active >= centre.config.maxActivePerDay) {
      throw new AppError(409, "ALREADY_BOOKED", "You already have a token at this centre for that day.");
    }

    const seq = ((seqSnap.data()?.seq as number | undefined) ?? 0) + 1;
    const doc: TokenDoc = {
      number: formatTokenNumber(tokenPrefixFor(centre.kind, centre.code), seq),
      seq,
      centreId: centre.id,
      centreName: centre.name,
      confidential: centre.confidential,
      kind: "booked",
      userId: user.uid,
      person: {
        name: user.name,
        type: user.userType ?? "student",
        id: userIdValue(user),
        mobile: user.mobile,
        email: user.email,
        category: null,
      },
      ...service,
      date: body.date,
      slot: body.slot,
      slotStart: istDateTime(body.date, body.slot).getTime(),
      status: centre.config.autoConfirm ? "CONFIRMED" : "REQUESTED",
      createdAt: now,
      checkedInAt: null,
      calledAt: null,
      completedAt: null,
      counterId: null,
      counterName: null,
      servedBy: null,
      notes: [],
      cancelledBy: null,
      cancelReason: null,
      reminderSent: false,
      feedbackGiven: false,
    };

    // ---- writes ----
    tx.create(tokenRef, doc);
    tx.set(dayRef, { centreId: body.centreId, date: body.date, counts: { [key]: FieldValue.increment(1) } }, { merge: true });
    tx.set(seqRef, { seq });
    return doc;
  });

  await notifyToken(token.status === "CONFIRMED" ? "booking_confirmed" : "booking_pending", tokenRef.id, token);
  await writeAudit({
    actorUid: user.uid,
    action: "token.book",
    targetType: "token",
    targetId: tokenRef.id,
    centreId: body.centreId,
    meta: { number: token.number, date: body.date, slot: body.slot },
    requestId,
  });
  return toStudentView({ id: tokenRef.id, ...token }, now, settings);
}

/* ----------------------------- my tokens ----------------------------- */

export async function listMyTokens(user: UserWithId, limit: number, cursor?: number) {
  const settings = await getBookingSettings();
  let q = tokensCol().where("userId", "==", user.uid).orderBy("createdAt", "desc");
  if (cursor !== undefined) q = q.startAfter(cursor);
  const snap = await q.limit(limit + 1).get();
  const now = Date.now();
  const page = snap.docs.slice(0, limit);
  const tokens = page.map((d) => toStudentView(parseToken(d.id, d.data()), now, settings));
  const last = page[page.length - 1];
  const nextCursor = snap.docs.length > limit && last ? (last.data().createdAt as number) : null;
  return { tokens, nextCursor };
}

/** One of my tokens, with my place in the line when I am waiting. */
export async function getMyToken(user: UserWithId, id: string) {
  const settings = await getBookingSettings();
  const snap = await tokensCol().doc(id).get();
  if (!snap.exists) throw notFound("Token not found.");
  const t = parseToken(id, snap.data());
  if (t.userId !== user.uid) throw notFound("Token not found.");
  const now = Date.now();
  const view = toStudentView(t, now, settings);

  let queue: { position: number; expectedAt: number; inMinutes: number; nowServing: string[] } | null = null;
  if (t.status === "CHECKED_IN" && t.date === istDateKey(new Date(now))) {
    const [centre, snapshot] = await Promise.all([getCentreDoc(t.centreId), readSnapshot(t.centreId, t.date)]);
    const open = centre.counters.filter((c) => c.active);
    const est = estimateTimes(snapshot, centre.config, open, now);
    const idx = est.findIndex((e) => e.tokenId === id);
    if (idx >= 0) {
      queue = {
        position: idx + 1,
        expectedAt: est[idx].expectedAt,
        inMinutes: est[idx].inMinutes,
        nowServing: snapshot.serving.map((s) => s.tokenNumber),
      };
    }
  }
  return { token: view, queue, serverTime: now };
}

export async function cancelByUser(user: UserWithId, tokenId: string, requestId: string) {
  const settings = await getBookingSettings();
  const now = Date.now();
  const db = adminDb();
  const ref = tokensCol().doc(tokenId);

  const t = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("Token not found.");
    const token = parseToken(tokenId, snap.data());
    if (token.userId !== user.uid) throw notFound("Token not found.");
    const status = effectiveStatus(token, now, settings.noShowGraceMinutes);
    if (status !== "REQUESTED" && status !== "CONFIRMED") {
      throw conflict("This token can no longer be cancelled.");
    }
    if (!canCancelByUser(token.slotStart, now, settings.cancelBeforeMinutes)) {
      throw conflict(`You can cancel up to ${settings.cancelBeforeMinutes} minutes before your slot.`);
    }
    tx.update(ref, { status: "CANCELLED", cancelledBy: "user" });
    if (token.slot) {
      tx.set(slotDayRef(token.centreId, token.date), { counts: { [slotKey(token.slot)]: FieldValue.increment(-1) } }, { merge: true });
    }
    return token;
  });

  await notifyToken("booking_cancelled", tokenId, t);
  await writeAudit({
    actorUid: user.uid,
    action: "token.cancel_user",
    targetType: "token",
    targetId: tokenId,
    centreId: t.centreId,
    requestId,
  });
  return { cancelled: true };
}

/* -------------------- centre staff / admin: tokens -------------------- */

export async function listCentreTokens(
  actor: UserWithId,
  centreId: string,
  date: string,
  status?: string,
) {
  const centre = await getCentreDoc(centreId);
  assertTokenAccess(actor, centre);
  const settings = await getBookingSettings();
  const snap = await tokensCol().where("centreId", "==", centreId).where("date", "==", date).get();
  const now = Date.now();
  const tokens = snap.docs
    .map((d) => toStaffView(parseToken(d.id, d.data()), now, settings))
    .filter((t) => !status || t.status === status)
    .sort((a, b) => (a.slot ?? "99:99").localeCompare(b.slot ?? "99:99") || a.createdAt - b.createdAt);
  return { tokens };
}

/** Loads a token and checks the caller may work on its centre. */
export async function tokenForStaff(actor: UserWithId, tokenId: string) {
  const snap = await tokensCol().doc(tokenId).get();
  if (!snap.exists) throw notFound("Token not found.");
  const t = parseToken(tokenId, snap.data());
  assertTokenAccess(actor, { id: t.centreId, confidential: t.confidential });
  return t;
}

export async function approveToken(actor: UserWithId, tokenId: string, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const settings = await getBookingSettings();
  const now = Date.now();
  const ref = tokensCol().doc(tokenId);
  const t = await adminDb().runTransaction(async (tx) => {
    const token = parseToken(tokenId, (await tx.get(ref)).data());
    if (effectiveStatus(token, now, settings.noShowGraceMinutes) !== "REQUESTED") {
      throw conflict("Only a waiting request can be approved.");
    }
    tx.update(ref, { status: "CONFIRMED" });
    return token;
  });
  await notifyToken("booking_approved", tokenId, t);
  await writeAudit({ actorUid: actor.uid, action: "token.approve", targetType: "token", targetId: tokenId, centreId: pre.centreId, requestId });
  return { status: "CONFIRMED" as const };
}

export async function rejectToken(actor: UserWithId, tokenId: string, reason: string, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const settings = await getBookingSettings();
  const now = Date.now();
  const ref = tokensCol().doc(tokenId);
  const t = await adminDb().runTransaction(async (tx) => {
    const token = parseToken(tokenId, (await tx.get(ref)).data());
    if (effectiveStatus(token, now, settings.noShowGraceMinutes) !== "REQUESTED") {
      throw conflict("Only a waiting request can be rejected.");
    }
    tx.update(ref, { status: "REJECTED", cancelledBy: "admin", cancelReason: reason });
    if (token.slot) {
      tx.set(slotDayRef(token.centreId, token.date), { counts: { [slotKey(token.slot)]: FieldValue.increment(-1) } }, { merge: true });
    }
    return token;
  });
  await notifyToken("booking_rejected", tokenId, t, { reason });
  await writeAudit({ actorUid: actor.uid, action: "token.reject", targetType: "token", targetId: tokenId, centreId: pre.centreId, requestId });
  return { status: "REJECTED" as const };
}

/** Cancel on behalf of the centre. Allowed until the token is being served. */
export async function cancelByAdmin(actor: UserWithId, tokenId: string, reason: string | undefined, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const ref = tokensCol().doc(tokenId);
  const t = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const token = parseToken(tokenId, snap.data());
    if (!["REQUESTED", "CONFIRMED", "CHECKED_IN"].includes(token.status)) {
      throw conflict("This token cannot be cancelled any more.");
    }
    const snapshot = token.status === "CHECKED_IN" ? await readSnapshotTx(tx, token.centreId, token.date) : null;

    tx.update(ref, { status: "CANCELLED", cancelledBy: "admin", cancelReason: reason ?? null });
    if (token.slot) {
      tx.set(slotDayRef(token.centreId, token.date), { counts: { [slotKey(token.slot)]: FieldValue.increment(-1) } }, { merge: true });
    }
    if (snapshot) tx.set(snapRef(token.centreId), dequeue(snapshot, tokenId));
    return token;
  });
  await notifyToken("booking_cancelled", tokenId, t, { byAdmin: true, reason: reason ?? null });
  await writeAudit({ actorUid: actor.uid, action: "token.cancel_admin", targetType: "token", targetId: tokenId, centreId: pre.centreId, requestId });
  return { cancelled: true };
}

/** Change the slot, date or service of a booking that has not been served. */
export async function modifyToken(actor: UserWithId, tokenId: string, body: ModifyTokenBody, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const now = Date.now();
  const db = adminDb();
  const ref = tokensCol().doc(tokenId);

  const updated = await db.runTransaction(async (tx) => {
    const newDate = body.date ?? pre.date;
    const newSlot = body.slot ?? pre.slot;
    const slotChanges = newDate !== pre.date || newSlot !== pre.slot;
    const newDayRef = slotDayRef(pre.centreId, newDate);

    const [tokenSnap, centreSnap, newDaySnap] = await Promise.all([
      tx.get(ref),
      tx.get(centreRef(pre.centreId)),
      slotChanges ? tx.get(newDayRef) : Promise.resolve(null),
    ]);
    const token = parseToken(tokenId, tokenSnap.data());
    if (token.status !== "REQUESTED" && token.status !== "CONFIRMED") {
      throw conflict("Only a booking that has not started can be changed.");
    }
    if (token.slot === null || newSlot === null) throw badRequest("Walk-ins have no slot to change.");
    const centre = parseCentre(pre.centreId, centreSnap.data());

    const changes: Record<string, unknown> = {};
    if (body.serviceId !== undefined || body.otherText !== undefined) {
      Object.assign(changes, resolveService(centre, body));
    }
    if (slotChanges) {
      const day = readSlotDay(newDaySnap?.data());
      const hours = centre.config.hours[DAY_KEYS[istWeekday(newDate)]];
      if (day.closed || !bookableSlots(hours, day.blocked).includes(newSlot)) {
        throw badRequest("The new slot is not available.");
      }
      if (istDateTime(newDate, newSlot).getTime() <= now) throw badRequest("The new slot has already started.");
      if ((day.counts[slotKey(newSlot)] ?? 0) >= centre.config.slotCapacity) {
        throw new AppError(409, "SLOT_FULL", "The new slot is full.");
      }
      Object.assign(changes, { date: newDate, slot: newSlot, slotStart: istDateTime(newDate, newSlot).getTime() });

      const oldKey = slotKey(token.slot);
      const newKey = slotKey(newSlot);
      if (newDate === token.date) {
        tx.set(newDayRef, { counts: { [oldKey]: FieldValue.increment(-1), [newKey]: FieldValue.increment(1) } }, { merge: true });
      } else {
        tx.set(slotDayRef(token.centreId, token.date), { counts: { [oldKey]: FieldValue.increment(-1) } }, { merge: true });
        tx.set(newDayRef, { centreId: token.centreId, date: newDate, counts: { [newKey]: FieldValue.increment(1) } }, { merge: true });
      }
    }
    tx.update(ref, changes);
    return { ...token, ...changes } as typeof token;
  });

  await notifyToken("booking_modified", tokenId, updated, {}, `_${now}`);
  await writeAudit({ actorUid: actor.uid, action: "token.modify", targetType: "token", targetId: tokenId, centreId: pre.centreId, meta: { fields: Object.keys(body).join(",") }, requestId });
  const settings = await getBookingSettings();
  return { token: toStaffView({ ...updated, id: tokenId }, now, settings) };
}
