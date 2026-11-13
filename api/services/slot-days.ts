import { z } from "zod";

/** `slotDays/{centreId}_{date}`: how many are booked per slot, plus date-specific blocks. */
const slotDaySchema = z.object({
  counts: z.record(z.string(), z.number()).default({}),
  blocked: z.array(z.string()).default([]),
  closed: z.boolean().default(false),
  note: z.string().nullable().default(null),
});
export type SlotDay = z.infer<typeof slotDaySchema>;

export const slotDayId = (centreId: string, date: string) => `${centreId}_${date}`;

export function readSlotDay(data: unknown): SlotDay {
  const parsed = slotDaySchema.safeParse(data ?? {});
  return parsed.success ? parsed.data : slotDaySchema.parse({});
}
