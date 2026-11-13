import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HOURS, bookableSlots, generateSlots, slotEnd, slotKey } from "../api/shared/slots";
import {
  ACTIVE_STATUSES,
  canCancelByUser,
  canSelfCheckIn,
  canTransition,
  effectiveStatus,
  formatTokenNumber,
} from "../api/shared/tokens";
import {
  ADAPTIVE_AFTER,
  dequeue,
  emptySnapshot,
  enqueue,
  estimateTimes,
  finishServing,
  minutesPerToken,
  orderWaiting,
  rollDate,
  startServing,
  type QueueEntry,
} from "../api/shared/queue";
import { addDays, daysBetween, formatDateKey, istDateKey, istHHmm, isDateKey } from "../api/shared/time";
import { dayHoursSchema, centreConfigSchema } from "../api/shared/schemas";
import { buildSlotViews } from "../api/services/centre-setup";
import { readSlotDay } from "../api/services/slot-days";
import { parseCentre } from "../api/services/centres";

/* ------------------------------ slots ------------------------------ */

test("weekday has 14 slots, Saturday 9, Sunday none", () => {
  assert.equal(bookableSlots(DEFAULT_HOURS.mon).length, 14);
  assert.equal(bookableSlots(DEFAULT_HOURS.sat).length, 9);
  assert.equal(bookableSlots(DEFAULT_HOURS.sun).length, 0);
});

test("lunch slots are left out; edges are right", () => {
  const slots = bookableSlots(DEFAULT_HOURS.mon);
  assert.equal(slots[0], "08:30");
  assert.ok(slots.includes("13:00"));
  assert.ok(!slots.includes("13:30"));
  assert.ok(!slots.includes("14:00"));
  assert.ok(slots.includes("14:30"));
  assert.equal(slots[slots.length - 1], "16:00");
  assert.equal(slotEnd("16:00"), "16:30");
  assert.equal(slotKey("08:30"), "0830");
});

test("blocked slots are marked, not removed", () => {
  const all = generateSlots(DEFAULT_HOURS.mon, ["10:00"]);
  assert.equal(all.find((s) => s.start === "10:00")?.blocked, true);
  assert.equal(bookableSlots(DEFAULT_HOURS.mon, ["10:00"]).length, 13);
});

test("hours validation", () => {
  assert.ok(dayHoursSchema.safeParse({ open: "08:30", close: "16:30", lunchStart: "13:30", lunchEnd: "14:30" }).success);
  assert.ok(!dayHoursSchema.safeParse({ open: "16:30", close: "08:30" }).success);
  assert.ok(!dayHoursSchema.safeParse({ open: "08:15", close: "16:30" }).success);
  assert.ok(!dayHoursSchema.safeParse({ open: "08:30", close: "16:30", lunchStart: "13:30" }).success);
});

test("centre config has the agreed defaults", () => {
  const c = centreConfigSchema.parse({});
  assert.equal(c.slotCapacity, 6);
  assert.equal(c.autoConfirm, true);
  assert.equal(c.maxActivePerDay, 1);
  assert.equal(c.minutesPerToken, 5);
  assert.equal(c.upcomingCount, 5);
});

test("slot views: states and past slots", () => {
  const centre = parseCentre("its", { name: "IT Services", code: "ITS" });
  const date = "2026-11-16"; // Monday
  const day = readSlotDay({ counts: { "0830": 6, "0900": 5, "0930": 1 }, blocked: ["10:00"] });
  const now = new Date("2026-11-16T03:10:00Z").getTime(); // 08:40 IST
  const v = buildSlotViews(centre, date, day, now);
  const by = Object.fromEntries(v.slots.map((s) => [s.start, s.state]));
  assert.equal(by["08:30"], "past");
  assert.equal(by["09:00"], "few");
  assert.equal(by["09:30"], "available");
  assert.equal(by["10:00"], "blocked");
  assert.equal(buildSlotViews(centre, "2026-11-15", day, now).closed, true); // Sunday
  assert.equal(buildSlotViews(centre, date, readSlotDay({ closed: true }), now).closed, true);
  const full = buildSlotViews(centre, "2026-11-17", readSlotDay({ counts: { "0830": 6 } }), now);
  assert.equal(full.slots[0].state, "full");
});

/* ------------------------------ tokens ----------------------------- */

test("token numbers", () => {
  assert.equal(formatTokenNumber("ITS", 14), "ITS-014");
  assert.equal(formatTokenNumber("DEP-CS", 3), "DEP-CS-003");
  assert.equal(formatTokenNumber("ITS", 1234), "ITS-1234");
});

test("allowed status changes", () => {
  assert.ok(canTransition("CONFIRMED", "CHECKED_IN"));
  assert.ok(canTransition("CHECKED_IN", "IN_SERVICE"));
  assert.ok(canTransition("IN_SERVICE", "COMPLETED"));
  assert.ok(canTransition("REQUESTED", "CONFIRMED"));
  assert.ok(!canTransition("COMPLETED", "CANCELLED"));
  assert.ok(!canTransition("NO_SHOW", "CHECKED_IN"));
  assert.ok(!canTransition("IN_SERVICE", "CANCELLED"));
  assert.ok(ACTIVE_STATUSES.includes("CHECKED_IN"));
  assert.ok(!ACTIVE_STATUSES.includes("NO_SHOW"));
});

test("no-show is worked out on read (15 minute grace)", () => {
  const slotStart = new Date("2026-11-16T04:30:00Z").getTime(); // 10:00 IST
  const t = { status: "CONFIRMED" as const, slotStart };
  assert.equal(effectiveStatus(t, slotStart + 14 * 60_000, 15), "CONFIRMED");
  assert.equal(effectiveStatus(t, slotStart + 16 * 60_000, 15), "NO_SHOW");
  assert.equal(effectiveStatus({ status: "CHECKED_IN", slotStart }, slotStart + 99 * 60_000, 15), "CHECKED_IN");
  assert.equal(effectiveStatus({ status: "REQUESTED", slotStart }, slotStart + 16 * 60_000, 15), "CANCELLED");
  assert.equal(effectiveStatus({ status: "CONFIRMED", slotStart: null }, slotStart, 15), "CONFIRMED");
});

test("cancel up to 60 minutes before; self check-in from 15 minutes before", () => {
  const s = new Date("2026-11-16T04:30:00Z").getTime();
  assert.ok(canCancelByUser(s, s - 61 * 60_000, 60));
  assert.ok(canCancelByUser(s, s - 60 * 60_000, 60));
  assert.ok(!canCancelByUser(s, s - 59 * 60_000, 60));
  assert.ok(!canCancelByUser(null, s, 60));
  assert.ok(!canSelfCheckIn(s, s - 16 * 60_000, 15));
  assert.ok(canSelfCheckIn(s, s - 15 * 60_000, 15));
  assert.ok(canSelfCheckIn(s, s + 15 * 60_000, 15));
  assert.ok(!canSelfCheckIn(s, s + 16 * 60_000, 15));
});

/* ------------------------------- queue ------------------------------ */

const entry = (n: number, checkedInAt: number, slotStart: number | null): QueueEntry => ({
  tokenId: `t${n}`,
  tokenNumber: `ITS-${String(n).padStart(3, "0")}`,
  checkedInAt,
  slotStart,
  walkIn: slotStart === null,
});

test("queue order: slots that started first, then arrival order", () => {
  const now = 1_000_000;
  const list = [
    entry(1, 100, null), // walk-in, arrived first
    entry(2, 200, now + 50_000), // booked, slot not started yet (early)
    entry(3, 300, now - 20_000), // booked, slot started later than #4's
    entry(4, 400, now - 90_000), // booked, earliest slot
  ];
  assert.deepEqual(
    orderWaiting(list, now).map((e) => e.tokenId),
    ["t4", "t3", "t1", "t2"],
  );
});

test("snapshot changes: join, leave, serve, finish", () => {
  let s = emptySnapshot("its", "2026-11-16");
  s = enqueue(s, entry(1, 100, null));
  s = enqueue(s, entry(1, 100, null)); // same token twice: ignored
  assert.equal(s.waiting.length, 1);
  assert.equal(s.version, 1);
  s = startServing(s, entry(1, 100, null), { tokenId: "t1", tokenNumber: "ITS-001", counterId: "c1", counterName: "Counter 1", calledAt: 1000 });
  assert.equal(s.waiting.length, 0);
  assert.equal(s.serving.length, 1);
  s = finishServing(s, "t1", 1000 + 4 * 60_000);
  assert.equal(s.serving.length, 0);
  assert.equal(s.completedToday, 1);
  assert.equal(s.serviceMsToday, 4 * 60_000);
  assert.equal(dequeue(s, "nope"), s);
  assert.equal(rollDate(s, "2026-11-17").waiting.length, 0);
  assert.equal(rollDate(s, "2026-11-17").completedToday, 0);
});

test("expected times follow the written example", () => {
  // One counter. Token being served was called 3 minutes ago, 5 minutes each:
  // 2 minutes left -> next waiting token in 2 min, then every 5 min.
  const now = 40_000_000;
  let s = emptySnapshot("its", "2026-11-16");
  s = { ...s, serving: [{ tokenId: "x", tokenNumber: "ITS-000", counterId: "c1", counterName: "C1", calledAt: now - 3 * 60_000 }] };
  for (let i = 1; i <= 3; i++) s = enqueue(s, entry(i, i, null));
  const est = estimateTimes(s, { minutesPerToken: 5, adaptiveEstimate: false }, [{ id: "c1" }], now);
  assert.deepEqual(est.map((e) => e.inMinutes), [2, 7, 12]);
  assert.deepEqual(est.map((e) => e.tokenNumber), ["ITS-001", "ITS-002", "ITS-003"]);
});

test("expected times: idle counters and several counters", () => {
  const now = 40_000_000;
  let s = emptySnapshot("its", "2026-11-16");
  for (let i = 1; i <= 4; i++) s = enqueue(s, entry(i, i, null));
  const one = estimateTimes(s, { minutesPerToken: 5, adaptiveEstimate: false }, [{ id: "c1" }], now);
  assert.deepEqual(one.map((e) => e.inMinutes), [0, 5, 10, 15]);
  const two = estimateTimes(s, { minutesPerToken: 5, adaptiveEstimate: false }, [{ id: "c1" }, { id: "c2" }], now);
  assert.deepEqual(two.map((e) => e.inMinutes), [0, 0, 5, 5]);
  assert.deepEqual(estimateTimes(s, { minutesPerToken: 5, adaptiveEstimate: false }, [], now), []);
});

test("a token that has run over still counts at least 1 more minute", () => {
  const now = 40_000_000;
  let s = emptySnapshot("its", "2026-11-16");
  s = { ...s, serving: [{ tokenId: "x", tokenNumber: "ITS-000", counterId: "c1", counterName: "C1", calledAt: now - 20 * 60_000 }] };
  s = enqueue(s, entry(1, 1, null));
  const est = estimateTimes(s, { minutesPerToken: 5, adaptiveEstimate: false }, [{ id: "c1" }], now);
  assert.equal(est[0].inMinutes, 1);
});

test("adaptive average starts after 10 finished services", () => {
  const base = { ...emptySnapshot("its", "2026-11-16"), completedToday: ADAPTIVE_AFTER - 1, serviceMsToday: 8 * 60_000 * (ADAPTIVE_AFTER - 1) };
  assert.equal(minutesPerToken(base, { minutesPerToken: 5, adaptiveEstimate: true }), 5);
  const ten = { ...base, completedToday: ADAPTIVE_AFTER, serviceMsToday: 8 * 60_000 * ADAPTIVE_AFTER };
  assert.equal(minutesPerToken(ten, { minutesPerToken: 5, adaptiveEstimate: true }), 8);
  assert.equal(minutesPerToken(ten, { minutesPerToken: 5, adaptiveEstimate: false }), 5);
});

/* ------------------------------- time ------------------------------ */

test("date helpers", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-11-01", "2026-11-08"), 7);
  assert.equal(formatDateKey("2026-11-02"), "02 Nov 2026");
  assert.equal(istHHmm(new Date("2026-11-16T03:10:00Z")), "08:40");
  assert.equal(istDateKey(new Date("2026-11-16T20:00:00Z")), "2026-11-17");
  assert.ok(isDateKey("2026-11-16"));
  assert.ok(!isDateKey("2026-02-31"));
  assert.ok(!isDateKey("16-11-2026"));
});
