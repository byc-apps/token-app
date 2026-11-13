/** Slots are 30-minute buckets generated from a day's opening hours. */
export const SLOT_MINUTES = 30;

export interface DayHours {
  open: string; // "08:30"
  close: string; // "16:30" (last slot ends here)
  lunchStart: string | null;
  lunchEnd: string | null;
  blocked: string[]; // "no service" slot starts, every week on this day
}
export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export type WeekHours = Record<DayKey, DayHours | null>;

const weekday = (): DayHours => ({
  open: "08:30",
  close: "16:30",
  lunchStart: "13:30",
  lunchEnd: "14:30",
  blocked: [],
});

/** Mon-Fri 8:30-4:30 (lunch 1:30-2:30) = 14 slots. Saturday 8:30-1:00 = 9 slots. Sunday closed. */
export const DEFAULT_HOURS: WeekHours = {
  mon: weekday(),
  tue: weekday(),
  wed: weekday(),
  thu: weekday(),
  fri: weekday(),
  sat: { open: "08:30", close: "13:00", lunchStart: null, lunchEnd: null, blocked: [] },
  sun: null,
};

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

export const slotEnd = (start: string): string => fromMinutes(toMinutes(start) + SLOT_MINUTES);
/** "08:30" -> "0830" (safe key for Firestore maps) */
export const slotKey = (start: string): string => start.replace(":", "");
export const slotLabel = (start: string): string => `${start}-${slotEnd(start)}`;

export interface SlotInfo {
  start: string;
  blocked: boolean;
}

/**
 * Every bookable-looking slot of a day (lunch is left out). Blocked slots are
 * returned with blocked=true so screens can show them as "no service".
 */
export function generateSlots(day: DayHours | null, extraBlocked: string[] = []): SlotInfo[] {
  if (!day) return [];
  const blocked = new Set([...day.blocked, ...extraBlocked]);
  const lunchStart = day.lunchStart ? toMinutes(day.lunchStart) : null;
  const lunchEnd = day.lunchEnd ? toMinutes(day.lunchEnd) : null;
  const out: SlotInfo[] = [];
  for (let s = toMinutes(day.open); s + SLOT_MINUTES <= toMinutes(day.close); s += SLOT_MINUTES) {
    const overlapsLunch =
      lunchStart !== null && lunchEnd !== null && s < lunchEnd && s + SLOT_MINUTES > lunchStart;
    if (overlapsLunch) continue;
    const start = fromMinutes(s);
    out.push({ start, blocked: blocked.has(start) });
  }
  return out;
}

/** Starts of the slots that can be booked. */
export const bookableSlots = (day: DayHours | null, extraBlocked: string[] = []): string[] =>
  generateSlots(day, extraBlocked)
    .filter((s) => !s.blocked)
    .map((s) => s.start);
