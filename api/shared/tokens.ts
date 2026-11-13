import { z } from "zod";

export const TOKEN_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "REJECTED",
] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];
export const tokenStatusSchema = z.enum(TOKEN_STATUSES);

/** A person can hold only this many of these per centre per day (see centre config). */
export const ACTIVE_STATUSES: readonly TokenStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
];

const NEXT: Record<TokenStatus, readonly TokenStatus[]> = {
  REQUESTED: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_SERVICE", "CANCELLED"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  REJECTED: [],
};
export const canTransition = (from: TokenStatus, to: TokenStatus): boolean =>
  NEXT[from].includes(to);

export const formatTokenNumber = (prefix: string, seq: number): string =>
  `${prefix}-${String(seq).padStart(3, "0")}`;

/**
 * What the status really is right now. A confirmed token whose slot started more
 * than `graceMinutes` ago and was never checked in is a no-show, even if the job
 * has not recorded it yet.
 */
export function effectiveStatus(
  t: { status: TokenStatus; slotStart: number | null },
  nowMs: number,
  graceMinutes: number,
): TokenStatus {
  if (t.slotStart === null) return t.status;
  const late = nowMs > t.slotStart + graceMinutes * 60_000;
  if (t.status === "CONFIRMED" && late) return "NO_SHOW";
  if (t.status === "REQUESTED" && late) return "CANCELLED";
  return t.status;
}

/** Student can cancel up to `beforeMinutes` before the slot starts. */
export const canCancelByUser = (slotStart: number | null, nowMs: number, beforeMinutes: number) =>
  slotStart !== null && slotStart - nowMs >= beforeMinutes * 60_000;

/** Student can check in from 15 minutes before the slot until the grace time ends. */
export const SELF_CHECK_IN_BEFORE_MINUTES = 15;
export const canSelfCheckIn = (slotStart: number | null, nowMs: number, graceMinutes: number) =>
  slotStart !== null &&
  nowMs >= slotStart - SELF_CHECK_IN_BEFORE_MINUTES * 60_000 &&
  nowMs <= slotStart + graceMinutes * 60_000;

const personSchema = z.object({
  name: z.string(),
  type: z.enum(["student", "faculty", "visitor"]),
  id: z.string().nullable().default(null),
  mobile: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
});

/** Shape of a document in `tokens/{id}`. All times are milliseconds since 1970. */
export const tokenDocSchema = z.object({
  number: z.string(),
  seq: z.number().int(),
  centreId: z.string(),
  centreName: z.string(),
  confidential: z.boolean().default(false),
  kind: z.enum(["booked", "walkin"]),
  userId: z.string().nullable().default(null),
  person: personSchema,
  serviceId: z.string().nullable().default(null),
  serviceName: z.string(),
  otherText: z.string().nullable().default(null),
  date: z.string(),
  slot: z.string().nullable().default(null),
  slotStart: z.number().nullable().default(null),
  status: tokenStatusSchema,
  createdAt: z.number(),
  checkedInAt: z.number().nullable().default(null),
  calledAt: z.number().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  counterId: z.string().nullable().default(null),
  counterName: z.string().nullable().default(null),
  servedBy: z.string().nullable().default(null),
  notes: z.array(z.object({ at: z.number(), by: z.string(), text: z.string() })).default([]),
  cancelledBy: z.enum(["user", "admin", "system"]).nullable().default(null),
  cancelReason: z.string().nullable().default(null),
  reminderSent: z.boolean().default(false),
  feedbackGiven: z.boolean().default(false),
});
export type TokenDoc = z.infer<typeof tokenDocSchema>;
export type TokenWithId = TokenDoc & { id: string };
