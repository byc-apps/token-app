import { z } from "zod";

/**
 * One small document per centre (`queueSnapshots/{centreId}`) holds today's live queue.
 * It is changed in the same transaction as every token change, so it is always true.
 * It contains token numbers only: no names, no services.
 */
export const queueEntrySchema = z.object({
  tokenId: z.string(),
  tokenNumber: z.string(),
  checkedInAt: z.number(),
  slotStart: z.number().nullable(),
  walkIn: z.boolean(),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

export const servingSchema = z.object({
  tokenId: z.string(),
  tokenNumber: z.string(),
  counterId: z.string(),
  counterName: z.string(),
  calledAt: z.number(),
});
export type Serving = z.infer<typeof servingSchema>;

export const snapshotSchema = z.object({
  centreId: z.string(),
  date: z.string(),
  version: z.number().int(),
  waiting: z.array(queueEntrySchema),
  serving: z.array(servingSchema),
  completedToday: z.number().int(),
  serviceMsToday: z.number(),
});
export type QueueSnapshot = z.infer<typeof snapshotSchema>;

export const emptySnapshot = (centreId: string, date: string): QueueSnapshot => ({
  centreId,
  date,
  version: 0,
  waiting: [],
  serving: [],
  completedToday: 0,
  serviceMsToday: 0,
});

/** Yesterday's queue never carries over. */
export const rollDate = (snap: QueueSnapshot, date: string): QueueSnapshot =>
  snap.date === date ? snap : { ...emptySnapshot(snap.centreId, date), version: snap.version + 1 };

const bump = (s: QueueSnapshot): QueueSnapshot => ({ ...s, version: s.version + 1 });

export function enqueue(snap: QueueSnapshot, entry: QueueEntry): QueueSnapshot {
  if (snap.waiting.some((e) => e.tokenId === entry.tokenId)) return snap;
  return bump({ ...snap, waiting: [...snap.waiting, entry] });
}

export function dequeue(snap: QueueSnapshot, tokenId: string): QueueSnapshot {
  if (!snap.waiting.some((e) => e.tokenId === tokenId)) return snap;
  return bump({ ...snap, waiting: snap.waiting.filter((e) => e.tokenId !== tokenId) });
}

/**
 * Queue order: booked tokens whose slot has started come first (earliest slot, then
 * earliest arrival). Everyone else (walk-ins, early arrivals) follows in arrival order.
 */
export function orderWaiting(entries: QueueEntry[], nowMs: number): QueueEntry[] {
  const due = entries
    .filter((e) => e.slotStart !== null && e.slotStart <= nowMs)
    .sort((a, b) => (a.slotStart as number) - (b.slotStart as number) || a.checkedInAt - b.checkedInAt);
  const rest = entries
    .filter((e) => !(e.slotStart !== null && e.slotStart <= nowMs))
    .sort((a, b) => a.checkedInAt - b.checkedInAt);
  return [...due, ...rest];
}

export function startServing(snap: QueueSnapshot, entry: QueueEntry, serving: Serving): QueueSnapshot {
  return bump({
    ...snap,
    waiting: snap.waiting.filter((e) => e.tokenId !== entry.tokenId),
    serving: [...snap.serving.filter((s) => s.tokenId !== entry.tokenId), serving],
  });
}

export function finishServing(snap: QueueSnapshot, tokenId: string, nowMs: number): QueueSnapshot {
  const s = snap.serving.find((x) => x.tokenId === tokenId);
  if (!s) return snap;
  return bump({
    ...snap,
    serving: snap.serving.filter((x) => x.tokenId !== tokenId),
    completedToday: snap.completedToday + 1,
    serviceMsToday: snap.serviceMsToday + Math.max(0, nowMs - s.calledAt),
  });
}

export function moveServing(snap: QueueSnapshot, tokenId: string, counterId: string, counterName: string): QueueSnapshot {
  return bump({
    ...snap,
    serving: snap.serving.map((s) => (s.tokenId === tokenId ? { ...s, counterId, counterName } : s)),
  });
}

export interface EstimateConfig {
  minutesPerToken: number;
  adaptiveEstimate: boolean;
}
export interface OpenCounter {
  id: string;
}

/** After this many finished services the centre's own average replaces the fixed minutes. */
export const ADAPTIVE_AFTER = 10;

export function minutesPerToken(snap: QueueSnapshot, cfg: EstimateConfig): number {
  if (cfg.adaptiveEstimate && snap.completedToday >= ADAPTIVE_AFTER) {
    return Math.max(1, snap.serviceMsToday / snap.completedToday / 60_000);
  }
  return cfg.minutesPerToken;
}

export interface Estimate {
  tokenNumber: string;
  tokenId: string;
  expectedAt: number; // ms
  inMinutes: number;
}

/**
 * Expected start time of each waiting token.
 *  - time left for a token being served = minutes - minutes already spent (never below 1)
 *  - each waiting token goes to the counter that frees up first
 *  - that counter is busy for `minutes` more
 * The browser can run this every second using the snapshot's call times.
 */
export function estimateTimes(
  snap: QueueSnapshot,
  cfg: EstimateConfig,
  openCounters: OpenCounter[],
  nowMs: number,
): Estimate[] {
  const per = minutesPerToken(snap, cfg);
  if (openCounters.length === 0) return [];
  const freeAt = openCounters.map((c) => {
    const s = snap.serving.find((x) => x.counterId === c.id);
    if (!s) return nowMs;
    const spent = (nowMs - s.calledAt) / 60_000;
    return nowMs + Math.max(1, per - spent) * 60_000;
  });
  return orderWaiting(snap.waiting, nowMs).map((e) => {
    let best = 0;
    for (let i = 1; i < freeAt.length; i++) if (freeAt[i] < freeAt[best]) best = i;
    const expectedAt = freeAt[best];
    freeAt[best] = expectedAt + per * 60_000;
    return {
      tokenNumber: e.tokenNumber,
      tokenId: e.tokenId,
      expectedAt,
      inMinutes: Math.max(0, Math.round((expectedAt - nowMs) / 60_000)),
    };
  });
}
