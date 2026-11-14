import { formatDateKey as sharedFormatDateKey, TIME_ZONE } from "@shared/time";

export function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!day || !month || !year) throw new RangeError("Could not format date");
  return `${day} ${month} ${year}`;
}

export function formatDateKey(dateKey: string): string {
  return sharedFormatDateKey(dateKey);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    timeZone: TIME_ZONE,
  })
    .format(date)
    .toLowerCase();
}

export function formatTimeKey(time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError("Invalid time");
  const hour = Number(match[1]);
  const suffix = hour < 12 ? "am" : "pm";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${suffix}`;
}
