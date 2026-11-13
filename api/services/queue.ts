import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { AppError, badRequest, conflict, notFound } from "../lib/errors";
import { assertCentreAccess, assertTokenAccess } from "../middleware/guard";
import { tokenPrefixFor } from "../shared/centres";
import { idLinkKey, normaliseId, userIdValue } from "../shared/ids";
import {
  dequeue,
  enqueue,
  estimateTimes,
  finishServing,
  minutesPerToken,
  moveServing,
  orderWaiting,
  startServing,
} from "../shared/queue";
import { slotLabel } from "../shared/slots";
import type { UserWithId, WalkInBody } from "../shared/schemas";
import { istDateKey } from "../shared/time";
import {
  canSelfCheckIn,
  effectiveStatus,
  formatTokenNumber,
  type TokenDoc,
} from "../shared/tokens";
import { getCentreDoc, buildSlotViews } from "./centre-setup";
import { notifyToken } from "./emails";
import { getBookingSettings } from "./settings";
import { readSlotDay, slotDayId } from "./slot-days";
import { parseCentre } from "./centres";
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
import { tokenForStaff } from "./booking";
import { parseUserDoc } from "./users";

const centreRef = (id: string) => adminDb().collection("centres").doc(id);

/* ----------------------------- check in ----------------------------- */

async function doCheckIn(
  tokenId: string,
  guard: (t: TokenDoc, now: number, graceMinutes: number) => void,
) {
  const settings = await getBookingSettings();
  const now = Date.now();
  const today = istDateKey(new Date(now));
  const ref = tokensCol().doc(tokenId);

  const token = await adminDb().runTransaction(async (tx) => {
    const t = parseToken(tokenId, (await tx.get(ref)).data());
    if (t.date !== today) throw conflict("Only today's tokens can be checked in.");
    if (effectiveStatus(t, now, settings.noShowGraceMinutes) !== "CONFIRMED") {
      throw conflict("This token cannot be checked in.");
    }
    guard(t, now, settings.noShowGraceMinutes);
    const snap = await readSnapshotTx(tx, t.centreId, t.date);

    tx.update(ref, { status: "CHECKED_IN", checkedInAt: now });
    tx.set(
      snapRef(t.centreId),
      enqueue(snap, { tokenId, tokenNumber: t.number, checkedInAt: now, slotStart: t.slotStart, walkIn: t.kind === "walkin" }),
    );
    return { ...t, status: "CHECKED_IN" as const, checkedInAt: now };
  });
  return { token, now, settings };
}

/** Staff marks a person as arrived. */
export async function checkInByStaff(actor: UserWithId, tokenId: string, requestId: string) {
  await tokenForStaff(actor, tokenId);
  const { token, now, settings } = await doCheckIn(tokenId, () => undefined);
  await writeAudit({ actorUid: actor.uid, action: "token.check_in", targetType: "token", targetId: tokenId, centreId: token.centreId, requestId });
  return { token: toStaffView({ ...token, id: tokenId }, now, settings) };
}

/** The student checks in from "My token" (15 minutes before the slot until the grace time ends). */
export async function checkInBySelf(user: UserWithId, tokenId: string, requestId: string) {
  const { token, now, settings } = await doCheckIn(tokenId, (t, n, grace) => {
    if (t.userId !== user.uid) throw notFound("Token not found.");
    if (!canSelfCheckIn(t.slotStart, n, grace)) {
      throw conflict("You can check in from 15 minutes before your slot. Otherwise ask the centre staff.");
    }
  });
  await writeAudit({ actorUid: user.uid, action: "token.check_in_self", targetType: "token", targetId: tokenId, centreId: token.centreId, requestId });
  return { token: toStudentView({ ...token, id: tokenId }, now, settings) };
}

/* ------------------------------ serving ------------------------------ */

/** Each call is its own transaction, so two counters can never take the same token. */
export async function callNext(actor: UserWithId, centreId: string, counterId: string, requestId: string) {
  const now = Date.now();
  const today = istDateKey(new Date(now));
  const db = adminDb();
  const centrePre = await getCentreDoc(centreId);
  assertTokenAccess(actor, centrePre); // the reply shows who was called

  const result = await db.runTransaction(async (tx) => {
    const [centreSnap, snap] = await Promise.all([tx.get(centreRef(centreId)), readSnapshotTx(tx, centreId, today)]);
    const centre = parseCentre(centreId, centreSnap.data());
    const counter = centre.counters.find((c) => c.id === counterId && c.active);
    if (!counter) throw badRequest("Unknown or inactive counter.");
    if (snap.serving.some((s) => s.counterId === counterId)) {
      throw new AppError(409, "COUNTER_BUSY", "This counter is already serving a token. Close it first.");
    }

    let next = snap;
    let picked: { token: ReturnType<typeof parseToken> } | null = null;
    for (const e of orderWaiting(snap.waiting, now)) {
      const ts = await tx.get(tokensCol().doc(e.tokenId));
      const t = ts.exists ? parseToken(e.tokenId, ts.data()) : null;
      if (t && t.status === "CHECKED_IN") {
        picked = { token: t };
        next = startServing(next, e, {
          tokenId: e.tokenId,
          tokenNumber: e.tokenNumber,
          counterId,
          counterName: counter.name,
          calledAt: now,
        });
        break;
      }
      next = dequeue(next, e.tokenId); // stale entry
    }
    if (next !== snap) tx.set(snapRef(centreId), next);
    if (!picked) return null;

    tx.update(tokensCol().doc(picked.token.id), {
      status: "IN_SERVICE",
      calledAt: now,
      counterId,
      counterName: counter.name,
      servedBy: actor.uid,
    });
    return { ...picked.token, status: "IN_SERVICE" as const, calledAt: now, counterId, counterName: counter.name, servedBy: actor.uid };
  });

  const settings = await getBookingSettings();
  if (!result) return { token: null, message: "No one is waiting." };
  await writeAudit({ actorUid: actor.uid, action: "token.call", targetType: "token", targetId: result.id, centreId: centrePre.id, meta: { counter: counterId }, requestId });
  return { token: toStaffView(result, now, settings), message: null };
}

export async function closeToken(actor: UserWithId, tokenId: string, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const now = Date.now();
  const ref = tokensCol().doc(tokenId);

  const t = await adminDb().runTransaction(async (tx) => {
    const token = parseToken(tokenId, (await tx.get(ref)).data());
    if (token.status !== "IN_SERVICE") throw conflict("Only a token that is being served can be closed.");
    const snap = await readSnapshotTx(tx, token.centreId, token.date);
    tx.update(ref, { status: "COMPLETED", completedAt: now });
    tx.set(snapRef(token.centreId), finishServing(snap, tokenId, now));
    return token;
  });

  // Ask for feedback, unless the person switched that off.
  if (t.userId && t.person.email) {
    const u = await adminDb().collection("users").doc(t.userId).get();
    const allows = u.exists ? parseUserDoc(t.userId, u.data()).emailPrefs.feedbackRequests : true;
    if (allows) await notifyToken("feedback_request", tokenId, t);
  }
  await writeAudit({ actorUid: actor.uid, action: "token.close", targetType: "token", targetId: tokenId, centreId: pre.centreId, requestId });
  const settings = await getBookingSettings();
  return { token: toStaffView({ ...t, id: tokenId, status: "COMPLETED", completedAt: now }, now, settings) };
}

/** Move the token being served to another free counter. */
export async function transferToken(actor: UserWithId, tokenId: string, counterId: string, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const now = Date.now();
  const ref = tokensCol().doc(tokenId);

  const t = await adminDb().runTransaction(async (tx) => {
    const [tokenSnap, centreSnap] = await Promise.all([tx.get(ref), tx.get(centreRef(pre.centreId))]);
    const token = parseToken(tokenId, tokenSnap.data());
    if (token.status !== "IN_SERVICE") throw conflict("Only a token that is being served can be moved.");
    const centre = parseCentre(pre.centreId, centreSnap.data());
    const counter = centre.counters.find((c) => c.id === counterId && c.active);
    if (!counter) throw badRequest("Unknown or inactive counter.");
    const snap = await readSnapshotTx(tx, token.centreId, token.date);
    if (snap.serving.some((s) => s.counterId === counterId)) {
      throw new AppError(409, "COUNTER_BUSY", "That counter is already serving a token.");
    }
    tx.update(ref, { counterId, counterName: counter.name });
    tx.set(snapRef(token.centreId), moveServing(snap, tokenId, counterId, counter.name));
    return { ...token, counterId, counterName: counter.name };
  });
  await writeAudit({ actorUid: actor.uid, action: "token.transfer", targetType: "token", targetId: tokenId, centreId: pre.centreId, meta: { counter: counterId }, requestId });
  const settings = await getBookingSettings();
  return { token: toStaffView({ ...t, id: tokenId }, now, settings) };
}

/** Timestamped note about what was done during service. */
export async function addNote(actor: UserWithId, tokenId: string, text: string, requestId: string) {
  const pre = await tokenForStaff(actor, tokenId);
  const now = Date.now();
  const ref = tokensCol().doc(tokenId);
  const t = await adminDb().runTransaction(async (tx) => {
    const token = parseToken(tokenId, (await tx.get(ref)).data());
    if (!["CHECKED_IN", "IN_SERVICE", "COMPLETED"].includes(token.status)) {
      throw conflict("Notes can be added once the person has arrived.");
    }
    if (token.notes.length >= 50) throw conflict("This token has too many notes.");
    const notes = [...token.notes, { at: now, by: actor.uid, text }];
    tx.update(ref, { notes });
    return { ...token, notes };
  });
  await writeAudit({ actorUid: actor.uid, action: "token.note", targetType: "token", targetId: tokenId, centreId: pre.centreId, requestId });
  const settings = await getBookingSettings();
  return { token: toStaffView({ ...t, id: tokenId }, now, settings) };
}

/* ------------------------------ walk-ins ------------------------------ */

export async function createWalkIn(actor: UserWithId, centreId: string, body: WalkInBody, requestId: string) {
  const db = adminDb();
  const now = Date.now();
  const today = istDateKey(new Date(now));
  const centrePre = await getCentreDoc(centreId);
  assertTokenAccess(actor, centrePre);
  if (!centrePre.active) throw badRequest("This centre is not active.");

  // Who is this? A registered CHRIST user (by Register No. / Employee ID) or a visitor.
  let userId: string | null = null;
  let person: TokenDoc["person"];
  if (body.kind === "christ") {
    const id = normaliseId(body.id);
    const [a, b] = await Promise.all([
      db.collection("idLinks").doc(idLinkKey("student", id)).get(),
      db.collection("idLinks").doc(idLinkKey("faculty", id)).get(),
    ]);
    const link = a.exists ? a : b.exists ? b : null;
    if (!link) throw notFound("No registered user has this ID. Add the person as a visitor instead.");
    const uSnap = await db.collection("users").doc(String(link.data()?.uid)).get();
    if (!uSnap.exists) throw notFound("No registered user has this ID.");
    const user = parseUserDoc(uSnap.id, uSnap.data());
    if (user.status !== "active") throw conflict("This account is disabled.");
    userId = user.uid;
    person = { name: user.name, type: user.userType ?? "student", id: userIdValue(user), mobile: user.mobile, email: user.email, category: null };
  } else {
    person = { name: body.name, type: "visitor", id: null, mobile: body.mobile, email: body.email ?? null, category: body.category };
  }

  const seqRef = db.collection("tokenSeq").doc(`${centreId}_${today}`);
  const tokenRef = tokensCol().doc();

  const doc = await db.runTransaction(async (tx) => {
    const [centreSnap, seqSnap, snap] = await Promise.all([
      tx.get(centreRef(centreId)),
      tx.get(seqRef),
      readSnapshotTx(tx, centreId, today),
    ]);
    const centre = parseCentre(centreId, centreSnap.data());
    const service = resolveService(centre, body);
    const seq = ((seqSnap.data()?.seq as number | undefined) ?? 0) + 1;
    const number = formatTokenNumber(tokenPrefixFor(centre.kind, centre.code), seq);
    const token: TokenDoc = {
      number,
      seq,
      centreId,
      centreName: centre.name,
      confidential: centre.confidential,
      kind: "walkin",
      userId,
      person,
      ...service,
      date: today,
      slot: null,
      slotStart: null,
      status: "CHECKED_IN",
      createdAt: now,
      checkedInAt: now,
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
    tx.create(tokenRef, token);
    tx.set(seqRef, { seq });
    tx.set(snapRef(centreId), enqueue(snap, { tokenId: tokenRef.id, tokenNumber: number, checkedInAt: now, slotStart: null, walkIn: true }));
    return token;
  });

  await notifyToken("walkin_recorded", tokenRef.id, doc);
  await writeAudit({ actorUid: actor.uid, action: "token.walkin", targetType: "token", targetId: tokenRef.id, centreId, meta: { number: doc.number, kind: body.kind }, requestId });
  const settings = await getBookingSettings();
  return { token: toStaffView({ id: tokenRef.id, ...doc }, now, settings) };
}

/* ------------------------- queue and display ------------------------- */

/**
 * The staff console polls this. It is one snapshot document plus the centre document.
 * Send the ETag back in If-None-Match to get "not changed" when nothing moved.
 * The browser works out expected times every second with estimateTimes().
 */
export async function getQueue(actor: UserWithId, centreId: string) {
  assertCentreAccess(actor, centreId);
  const now = Date.now();
  const today = istDateKey(new Date(now));
  const [centre, snap] = await Promise.all([getCentreDoc(centreId), readSnapshot(centreId, today)]);
  const open = centre.counters.filter((c) => c.active);
  const cfg = centre.config;

  const etag = `W/"${snap.version}-${snap.date}-${createHash("sha1")
    .update(JSON.stringify([cfg, centre.counters]))
    .digest("hex")
    .slice(0, 12)}"`;

  const body = {
    serverTime: now,
    date: today,
    version: snap.version,
    centre: { id: centre.id, name: centre.name, confidential: centre.confidential },
    counters: centre.counters,
    serving: snap.serving,
    waiting: orderWaiting(snap.waiting, now),
    completedToday: snap.completedToday,
    minutesPerToken: Math.round(minutesPerToken(snap, cfg) * 10) / 10,
    estimates: estimateTimes(snap, cfg, open, now),
    settings: {
      minutesPerToken: cfg.minutesPerToken,
      adaptiveEstimate: cfg.adaptiveEstimate,
      upcomingCount: cfg.upcomingCount,
      showExpectedTimes: cfg.showExpectedTimes,
      announcement: cfg.announcement,
      chime: cfg.chime,
      displayMode: cfg.displayMode,
    },
  };
  return { etag, body };
}

/** Token numbers only. Counselor and CAPS use the neutral screen. */
export async function getDisplay(actor: UserWithId, centreId: string) {
  assertCentreAccess(actor, centreId);
  const now = Date.now();
  const today = istDateKey(new Date(now));
  const db = adminDb();
  const [centre, snap, daySnap] = await Promise.all([
    getCentreDoc(centreId),
    readSnapshot(centreId, today),
    db.collection("slotDays").doc(slotDayId(centreId, today)).get(),
  ]);
  const cfg = centre.config;
  const slots = buildSlotViews(centre, today, readSlotDay(daySnap.data()), now);
  const common = {
    serverTime: now,
    version: snap.version,
    centre: { name: centre.name, location: centre.location },
    announcement: cfg.announcement,
    chime: cfg.chime,
    slots: slots.closed
      ? { closed: true, items: [] }
      : { closed: false, items: slots.slots.map((s) => ({ start: s.start, state: s.state, label: slotLabel(s.start) })) },
  };
  if (cfg.displayMode === "neutral") {
    return { ...common, mode: "neutral" as const, message: "Please be seated. You will be called.", serving: [], upcoming: [] };
  }
  const open = centre.counters.filter((c) => c.active);
  const est = estimateTimes(snap, cfg, open, now).slice(0, cfg.upcomingCount);
  return {
    ...common,
    mode: "tokens" as const,
    message: null,
    serving: snap.serving.map((s) => ({ tokenNumber: s.tokenNumber, counterName: s.counterName, calledAt: s.calledAt })),
    upcoming: est.map((e) => ({ tokenNumber: e.tokenNumber, ...(cfg.showExpectedTimes ? { expectedAt: e.expectedAt } : {}) })),
    minutesPerToken: Math.round(minutesPerToken(snap, cfg) * 10) / 10,
    showExpectedTimes: cfg.showExpectedTimes,
  };
}

