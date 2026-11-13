import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { AppError, badRequest } from "../lib/errors";
import { emptySnapshot, rollDate, snapshotSchema, type QueueSnapshot } from "../shared/queue";
import { slotEnd } from "../shared/slots";
import type { BookingSettings, CentreWithId } from "../shared/schemas";
import {
  canCancelByUser,
  canSelfCheckIn,
  effectiveStatus,
  tokenDocSchema,
  type TokenWithId,
} from "../shared/tokens";

export const tokensCol = () => adminDb().collection("tokens");
export const snapRef = (centreId: string) => adminDb().collection("queueSnapshots").doc(centreId);

export function parseToken(id: string, data: unknown): TokenWithId {
  const parsed = tokenDocSchema.safeParse(data);
  if (!parsed.success) {
    console.error("token_record_invalid", { id });
    throw new AppError(500, "TOKEN_RECORD_INVALID", "A token record needs attention.");
  }
  return { id, ...parsed.data };
}

/** Today's queue for a centre (read inside a transaction). Old days start empty. */
export async function readSnapshotTx(tx: Transaction, centreId: string, date: string): Promise<QueueSnapshot> {
  const s = await tx.get(snapRef(centreId));
  const parsed = s.exists ? snapshotSchema.safeParse(s.data()) : null;
  return rollDate(parsed?.success ? parsed.data : emptySnapshot(centreId, date), date);
}

/** Same, outside a transaction. */
export async function readSnapshot(centreId: string, date: string): Promise<QueueSnapshot> {
  const s = await snapRef(centreId).get();
  const parsed = s.exists ? snapshotSchema.safeParse(s.data()) : null;
  return rollDate(parsed?.success ? parsed.data : emptySnapshot(centreId, date), date);
}

/** Pick the service for a booking or walk-in: a listed service, or free text if the centre allows it. */
export function resolveService(
  centre: CentreWithId,
  input: { serviceId?: string; otherText?: string },
): { serviceId: string | null; serviceName: string; otherText: string | null } {
  if (input.serviceId !== undefined) {
    const s = centre.services.find((x) => x.id === input.serviceId && x.active);
    if (!s) throw badRequest("Unknown or inactive service.");
    return { serviceId: s.id, serviceName: s.name, otherText: null };
  }
  if (!input.otherText) throw badRequest("Choose a service.");
  if (!centre.config.allowOther) throw badRequest("This centre does not accept 'Other' requests.");
  return { serviceId: null, serviceName: "Other", otherText: input.otherText };
}

/** What the person who owns the token sees. */
export function toStudentView(t: TokenWithId, nowMs: number, s: BookingSettings) {
  const status = effectiveStatus(t, nowMs, s.noShowGraceMinutes);
  return {
    id: t.id,
    number: t.number,
    centreId: t.centreId,
    centreName: t.centreName,
    serviceName: t.serviceName,
    otherText: t.otherText,
    date: t.date,
    slot: t.slot,
    slotEnd: t.slot ? slotEnd(t.slot) : null,
    status,
    createdAt: t.createdAt,
    checkedInAt: t.checkedInAt,
    calledAt: t.calledAt,
    completedAt: t.completedAt,
    counterName: status === "IN_SERVICE" ? t.counterName : null,
    cancelReason: t.cancelReason,
    canCancel:
      (status === "REQUESTED" || status === "CONFIRMED") &&
      canCancelByUser(t.slotStart, nowMs, s.cancelBeforeMinutes),
    canCheckIn:
      status === "CONFIRMED" && canSelfCheckIn(t.slotStart, nowMs, s.noShowGraceMinutes),
    canGiveFeedback: status === "COMPLETED" && !t.feedbackGiven,
  };
}

/** What centre staff see (includes the person and the notes). */
export function toStaffView(t: TokenWithId, nowMs: number, s: BookingSettings) {
  return {
    id: t.id,
    number: t.number,
    kind: t.kind,
    centreId: t.centreId,
    person: t.person,
    serviceId: t.serviceId,
    serviceName: t.serviceName,
    otherText: t.otherText,
    date: t.date,
    slot: t.slot,
    status: effectiveStatus(t, nowMs, s.noShowGraceMinutes),
    storedStatus: t.status,
    createdAt: t.createdAt,
    checkedInAt: t.checkedInAt,
    calledAt: t.calledAt,
    completedAt: t.completedAt,
    counterId: t.counterId,
    counterName: t.counterName,
    servedBy: t.servedBy,
    notes: t.notes,
    cancelledBy: t.cancelledBy,
    cancelReason: t.cancelReason,
  };
}
