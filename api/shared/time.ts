/**
 * All slot / date logic is pinned to Asia/Kolkata (IST, fixed +05:30, no DST).
 * Vercel servers run in UTC, so never use the server's local time.
 */
export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

/** "YYYY-MM-DD" for the given instant, as seen in IST. */
export function istDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Convert an IST calendar date + "HH:mm" into a real instant (Date). */
export function istDateTime(dateKey: string, hhmm: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) {
    throw new RangeError("Invalid date or time");
  }
  const result = new Date(`${dateKey}T${hhmm}:00${IST_OFFSET}`);
  // JS silently rolls "2026-02-31" over to March 3, so confirm the date survives a round trip.
  if (Number.isNaN(result.getTime()) || istDateKey(result) !== dateKey) {
    throw new RangeError("Invalid date or time");
  }
  return result;
}

/** Day of week for an IST calendar date: 0 = Sunday … 6 = Saturday. */
export function istWeekday(dateKey: string): number {
  // Noon IST = 06:30 UTC on the same calendar date, so the UTC weekday is correct.
  return istDateTime(dateKey, "12:00").getUTCDay();
}
