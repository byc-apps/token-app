import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { getEnv } from "../lib/env";
import { slotKey } from "../shared/slots";
import { addDays, istDateKey, istHHmm } from "../shared/time";
import { effectiveStatus } from "../shared/tokens";
import { aggregateTokens } from "../shared/reports";
import { enqueueEmail, notifyToken } from "./emails";
import { processOutbox } from "./outbox";
import { getBookingSettings } from "./settings";
import { slotDayId } from "./slot-days";
import { parseToken, tokensCol } from "./token-common";
import { parseUserDoc } from "./users";

/**
 * Close tokens nobody came for. A confirmed token whose slot started more than the grace
 * time ago becomes NO_SHOW; a request nobody approved in time becomes CANCELLED.
 * Reads also show the right status before this runs, so this only makes it permanent.
 */
export async function markNoShows(nowMs: number) {
  const { noShowGraceMinutes } = await getBookingSettings();
  const db = adminDb();
  const today = istDateKey(new Date(nowMs));
  let noShow = 0;
  let cancelled = 0;

  for (const date of [addDays(today, -1), today]) {
    const snap = await tokensCol()
      .where("date", "==", date)
      .where("status", "in", ["CONFIRMED", "REQUESTED"])
      .limit(1000)
      .get();
    for (const doc of snap.docs) {
      const first = parseToken(doc.id, doc.data());
      const eff = effectiveStatus(first, nowMs, noShowGraceMinutes);
      if (eff !== "NO_SHOW" && eff !== "CANCELLED") continue;

      const done = await db.runTransaction(async (tx) => {
        const t = parseToken(doc.id, (await tx.get(doc.ref)).data());
        if (t.status !== first.status) return null;
        if (eff === "NO_SHOW") {
          tx.update(doc.ref, { status: "NO_SHOW" });
        } else {
          tx.update(doc.ref, { status: "CANCELLED", cancelledBy: "system", cancelReason: "Not approved in time" });
          if (t.slot) {
            tx.set(db.collection("slotDays").doc(slotDayId(t.centreId, t.date)), { counts: { [slotKey(t.slot)]: FieldValue.increment(-1) } }, { merge: true });
          }
        }
        return t;
      });
      if (!done) continue;
      if (eff === "NO_SHOW") {
        noShow++;
        await notifyToken("no_show", doc.id, done);
      } else {
        cancelled++;
        await notifyToken("booking_cancelled", doc.id, done, { bySystem: true });
      }
    }
  }
  return { noShow, cancelled };
}

/** Email people whose slot starts within the next 60 minutes (once per token). */
export async function sendReminders(nowMs: number) {
  const db = adminDb();
  const today = istDateKey(new Date(nowMs));
  const snap = await tokensCol().where("date", "==", today).where("status", "==", "CONFIRMED").limit(1000).get();
  let queued = 0;

  for (const doc of snap.docs) {
    const t = parseToken(doc.id, doc.data());
    if (t.reminderSent || t.slotStart === null) continue;
    if (!(t.slotStart > nowMs && t.slotStart - nowMs <= 60 * 60_000)) continue;

    const claimed = await db.runTransaction(async (tx) => {
      const fresh = parseToken(doc.id, (await tx.get(doc.ref)).data());
      if (fresh.reminderSent || fresh.status !== "CONFIRMED") return false;
      tx.update(doc.ref, { reminderSent: true });
      return true;
    });
    if (!claimed) continue;

    let wants = true;
    if (t.userId) {
      const u = await db.collection("users").doc(t.userId).get();
      if (u.exists) wants = parseUserDoc(t.userId, u.data()).emailPrefs.reminders;
    }
    if (wants) {
      await notifyToken("reminder", doc.id, t);
      queued++;
    }
  }
  return { queued };
}

/** After 5 PM IST, once per day: counts for each centre's admins. */
export async function sendDailySummaries(nowMs: number) {
  const now = new Date(nowMs);
  if (istHHmm(now) < "17:00") return { sent: 0, ran: false };
  const db = adminDb();
  const today = istDateKey(now);
  try {
    await db.collection("jobState").doc(`summary_${today}`).create({ at: nowMs });
  } catch (err) {
    if ((err as { code?: number }).code === 6) return { sent: 0, ran: false };
    throw err;
  }

  const { noShowGraceMinutes } = await getBookingSettings();
  const snap = await tokensCol().where("date", "==", today).limit(20000).get();
  const byCentre = new Map<string, ReturnType<typeof parseToken>[]>();
  for (const d of snap.docs) {
    const t = parseToken(d.id, d.data());
    byCentre.set(t.centreId, [...(byCentre.get(t.centreId) ?? []), t]);
  }

  let sent = 0;
  for (const [centreId, tokens] of byCentre) {
    const r = aggregateTokens(centreId, tokens, nowMs, noShowGraceMinutes, false);
    const admins = await db.collection("users").where("centreIds", "array-contains", centreId).get();
    for (const a of admins.docs) {
      const u = parseUserDoc(a.id, a.data());
      if (u.role !== "centre_admin" || u.status !== "active") continue;
      await enqueueEmail({
        dedupeKey: `summary_${centreId}_${today}_${u.uid}`,
        type: "daily_summary",
        to: u.email,
        userId: u.uid,
        centreId,
        data: {
          name: u.name,
          centreName: tokens[0]?.centreName,
          date: today,
          summary: { total: r.total, completed: r.completed, noShow: r.noShow, cancelled: r.cancelled, walkIns: r.walkIns },
          appUrl: getEnv().appUrl,
        },
      });
      sent++;
    }
  }
  return { sent, ran: true };
}

/** One call does everything. Run it every 5 minutes. Each step is safe to repeat. */
export async function tick(nowMs: number) {
  const out: Record<string, unknown> = {};
  const steps: [string, () => Promise<unknown>][] = [
    ["noShows", () => markNoShows(nowMs)],
    ["reminders", () => sendReminders(nowMs)],
    ["dailySummary", () => sendDailySummaries(nowMs)],
    ["outbox", () => processOutbox(nowMs)],
  ];
  for (const [name, run] of steps) {
    try {
      out[name] = await run();
    } catch (err) {
      console.error("job_step_failed", { step: name, message: (err as Error).message });
      out[name] = { error: true };
    }
  }
  return out;
}
