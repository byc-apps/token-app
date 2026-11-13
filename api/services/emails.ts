import { adminDb } from "../lib/firebase-admin";
import { getEnv } from "../lib/env";
import { formatDateKey } from "../shared/time";
import { slotLabel } from "../shared/slots";
import type { TokenDoc } from "../shared/tokens";

export const EMAIL_TYPES = [
  "welcome",
  "booking_confirmed",
  "booking_pending",
  "booking_approved",
  "booking_rejected",
  "booking_cancelled",
  "booking_modified",
  "reminder",
  "no_show",
  "walkin_recorded",
  "feedback_request",
  "daily_summary",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export interface EmailData {
  name: string;
  tokenNumber?: string;
  centreName?: string;
  /** null for confidential centres: their emails never mention the service. */
  serviceName?: string | null;
  date?: string; // YYYY-MM-DD
  slot?: string | null; // "HH:mm"
  reason?: string | null;
  byAdmin?: boolean;
  bySystem?: boolean;
  summary?: { total: number; completed: number; noShow: number; cancelled: number; walkIns: number };
  appUrl: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function whenLine(d: EmailData): string | null {
  if (!d.date) return null;
  return d.slot ? `${formatDateKey(d.date)}, ${slotLabel(d.slot)}` : formatDateKey(d.date);
}

/** Plain, short emails. Returns subject, text and html. */
export function renderEmail(type: EmailType, d: EmailData): { subject: string; text: string; html: string } {
  const token = d.tokenNumber ? `Token ${d.tokenNumber}` : "Your token";
  const when = whenLine(d);
  const where = d.centreName ? `Centre: ${d.centreName}` : null;
  const service = d.serviceName ? `Service: ${d.serviceName}` : null;
  const reason = d.reason ? `Reason: ${d.reason}` : null;
  const details = [token, where, service, when ? `When: ${when}` : null, reason].filter(Boolean) as string[];
  const link = `${d.appUrl}`;

  let subject: string;
  let intro: string;
  let extra: string[] = [];
  switch (type) {
    case "welcome":
      subject = "Welcome to BYC ServeQ";
      intro = `Hi ${d.name}, your account is ready. You can book a token at any service centre.`;
      break;
    case "booking_confirmed":
      subject = `Token ${d.tokenNumber} confirmed`;
      intro = `Hi ${d.name}, your booking is confirmed.`;
      extra = ["You can cancel from the app up to 60 minutes before your slot."];
      break;
    case "booking_pending":
      subject = `Token ${d.tokenNumber} received`;
      intro = `Hi ${d.name}, we received your booking. The centre will confirm it soon.`;
      break;
    case "booking_approved":
      subject = `Token ${d.tokenNumber} approved`;
      intro = `Hi ${d.name}, your booking was approved.`;
      break;
    case "booking_rejected":
      subject = `Token ${d.tokenNumber} was not approved`;
      intro = `Hi ${d.name}, your booking could not be approved.`;
      break;
    case "booking_cancelled":
      subject = `Token ${d.tokenNumber} cancelled`;
      intro = d.byAdmin
        ? `Hi ${d.name}, your booking was cancelled by the centre.`
        : d.bySystem
          ? `Hi ${d.name}, your booking was cancelled because it was not confirmed in time.`
          : `Hi ${d.name}, your booking was cancelled as you asked.`;
      break;
    case "booking_modified":
      subject = `Token ${d.tokenNumber} was changed`;
      intro = `Hi ${d.name}, the centre changed your booking. The new details are below.`;
      break;
    case "reminder":
      subject = `Reminder: token ${d.tokenNumber} soon`;
      intro = `Hi ${d.name}, your slot starts within the hour. Please reach the centre on time.`;
      extra = ["If you do not arrive within 15 minutes of your slot, the token counts as a no-show."];
      break;
    case "no_show":
      subject = `Token ${d.tokenNumber}: you did not attend`;
      intro = `Hi ${d.name}, you did not reach the centre for this booking, so it is closed. You can book again.`;
      break;
    case "walkin_recorded":
      subject = `Visit recorded: ${d.tokenNumber}`;
      intro = `Hi ${d.name}, your walk-in visit was recorded.`;
      break;
    case "feedback_request":
      subject = "How was your visit?";
      intro = `Hi ${d.name}, thanks for visiting. Please rate your visit in the app. Your feedback is anonymous.`;
      break;
    case "daily_summary": {
      const s = d.summary;
      subject = `Daily summary${d.centreName ? `: ${d.centreName}` : ""}`;
      intro = `Hi ${d.name}, here is today's summary${d.date ? ` (${formatDateKey(d.date)})` : ""}.`;
      extra = s
        ? [
            `Total tokens: ${s.total}`,
            `Completed: ${s.completed}`,
            `No-shows: ${s.noShow}`,
            `Cancelled: ${s.cancelled}`,
            `Walk-ins: ${s.walkIns}`,
          ]
        : [];
      break;
    }
  }
  const body = type === "welcome" || type === "feedback_request" || type === "daily_summary" ? extra : [...details, ...extra];
  const text = [intro, "", ...body, "", `Open the app: ${link}`, "", "BYC ServeQ, CHRIST (Deemed to be University)"].join("\n");
  const html =
    `<p>${esc(intro)}</p>` +
    (body.length ? `<ul>${body.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "") +
    `<p><a href="${esc(link)}">Open the app</a></p><p>BYC ServeQ, CHRIST (Deemed to be University)</p>`;
  return { subject, text, html };
}

/** Build email data from a token. Confidential centres never get the service name. */
export function tokenEmailData(t: TokenDoc, extra: Partial<EmailData> = {}): EmailData {
  return {
    name: t.person.name,
    tokenNumber: t.number,
    centreName: t.centreName,
    serviceName: t.confidential ? null : t.serviceName,
    date: t.date,
    slot: t.slot,
    appUrl: getEnv().appUrl,
    ...extra,
  };
}

export interface EnqueueInput {
  dedupeKey: string;
  type: EmailType;
  to: string;
  data: EmailData;
  userId?: string | null;
  tokenId?: string;
  centreId?: string;
}

/**
 * Put an email in the outbox. Never throws: email problems must not break a booking.
 * The same dedupeKey is only ever queued once.
 */
export async function enqueueEmail(input: EnqueueInput): Promise<void> {
  try {
    const id = input.dedupeKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 150);
    const now = Date.now();
    await adminDb()
      .collection("emailOutbox")
      .doc(id)
      .create({
        type: input.type,
        to: input.to,
        data: input.data,
        status: "queued",
        attempts: 0,
        nextAttemptAt: now,
        lockedUntil: 0,
        createdAt: now,
        sentAt: null,
        lastError: null,
        userId: input.userId ?? null,
        tokenId: input.tokenId ?? null,
        centreId: input.centreId ?? null,
      });
  } catch (err) {
    if ((err as { code?: number }).code === 6) return; // already queued
    console.error("email_enqueue_failed", { type: input.type, key: input.dedupeKey });
  }
}

/** Queue an email about a token to the person it belongs to (if they have an address). */
export async function notifyToken(
  type: EmailType,
  tokenId: string,
  t: TokenDoc,
  extra: Partial<EmailData> = {},
  keySuffix = "",
): Promise<void> {
  if (!t.person.email) return;
  await enqueueEmail({
    dedupeKey: `${type}_${tokenId}${keySuffix}`,
    type,
    to: t.person.email,
    data: tokenEmailData(t, extra),
    userId: t.userId,
    tokenId,
    centreId: t.centreId,
  });
}
