import { FieldValue, type Query } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { getEnv } from "../lib/env";
import { notFound } from "../lib/errors";
import type { UserWithId } from "../shared/schemas";
import { renderEmail, type EmailData, type EmailType } from "./emails";
import { sendMail, type Sender } from "./mailer";

const BACKOFF_MINUTES = [5, 15, 60, 360, 1440];
export const MAX_ATTEMPTS = 6;
const LOCK_MS = 5 * 60_000;

/** After a failed try: wait longer each time, give up after MAX_ATTEMPTS. */
export function nextAttempt(attempts: number, nowMs: number) {
  if (attempts >= MAX_ATTEMPTS) return { status: "failed" as const, nextAttemptAt: 0 };
  const wait = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 1440;
  return { status: "queued" as const, nextAttemptAt: nowMs + wait * 60_000 };
}

interface OutboxRow {
  type: EmailType;
  to: string;
  data: EmailData;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  nextAttemptAt: number;
  lockedUntil: number;
  createdAt: number;
}

const eligible = (r: OutboxRow, now: number) =>
  (r.status === "queued" && r.nextAttemptAt <= now) || (r.status === "sending" && r.lockedUntil < now);

/**
 * Send queued emails. Safe to run often and in parallel: each email is claimed in a
 * transaction first, so it is never sent twice at the same time.
 */
export async function processOutbox(nowMs: number, limit = 40, sender: Sender = sendMail) {
  const result = { sent: 0, retry: 0, failed: 0, skipped: false };
  if (sender === sendMail && !getEnv().smtp) return { ...result, skipped: true };

  const db = adminDb();
  const snap = await db.collection("emailOutbox").where("status", "in", ["queued", "sending"]).limit(300).get();
  const due = snap.docs
    .filter((d) => eligible(d.data() as OutboxRow, nowMs))
    .sort((a, b) => (a.data().createdAt as number) - (b.data().createdAt as number))
    .slice(0, limit);

  for (const doc of due) {
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const row = fresh.data() as OutboxRow | undefined;
      if (!row || !eligible(row, nowMs)) return null;
      tx.update(doc.ref, { status: "sending", lockedUntil: nowMs + LOCK_MS, attempts: row.attempts + 1 });
      return { ...row, attempts: row.attempts + 1 };
    });
    if (!claimed) continue;

    try {
      const mail = renderEmail(claimed.type, claimed.data);
      await sender({ to: claimed.to, ...mail });
      await doc.ref.update({ status: "sent", sentAt: nowMs, lastError: null });
      result.sent++;
    } catch (err) {
      const next = nextAttempt(claimed.attempts, nowMs);
      await doc.ref.update({
        status: next.status,
        nextAttemptAt: next.nextAttemptAt,
        lastError: String((err as Error).message).slice(0, 200),
      });
      if (next.status === "failed") result.failed++;
      else result.retry++;
    }
  }
  return result;
}

export async function listEmailLog(query: { status?: string; limit: number; cursor?: string }) {
  let q: Query = adminDb().collection("emailOutbox");
  if (query.status) q = q.where("status", "==", query.status);
  q = q.orderBy("createdAt", "desc");
  if (query.cursor) q = q.startAfter(Number(query.cursor));
  const snap = await q.limit(query.limit + 1).get();
  const page = snap.docs.slice(0, query.limit);
  const emails = page.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      type: x.type,
      to: x.to,
      status: x.status,
      attempts: x.attempts,
      createdAt: x.createdAt,
      sentAt: x.sentAt,
      lastError: x.lastError,
      tokenId: x.tokenId,
      centreId: x.centreId,
    };
  });
  const last = page[page.length - 1];
  const nextCursor = snap.docs.length > query.limit && last ? String(last.data().createdAt) : null;
  return { emails, nextCursor };
}

export async function resendEmail(actor: UserWithId, id: string, requestId: string) {
  const ref = adminDb().collection("emailOutbox").doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("Email not found.");
    tx.update(ref, {
      status: "queued",
      attempts: 0,
      nextAttemptAt: Date.now(),
      lockedUntil: 0,
      lastError: null,
    });
  });
  await writeAudit({
    actorUid: actor.uid,
    action: "email.resend",
    targetType: "email",
    targetId: id,
    requestId,
  });
  return { queued: true };
}

export async function updateEmailPrefs(
  user: UserWithId,
  patch: { reminders?: boolean; feedbackRequests?: boolean },
) {
  const emailPrefs = { ...user.emailPrefs, ...patch };
  await adminDb()
    .collection("users")
    .doc(user.uid)
    .update({ emailPrefs, updatedAt: FieldValue.serverTimestamp() });
  return emailPrefs;
}
