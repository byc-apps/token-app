import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateTokens, averageRating } from "../api/shared/reports";
import { tokenDocSchema, type TokenDoc } from "../api/shared/tokens";
import { renderEmail, tokenEmailData, EMAIL_TYPES } from "../api/services/emails";
import { MAX_ATTEMPTS, nextAttempt } from "../api/services/outbox";
import { toStaffView, toStudentView } from "../api/services/token-common";
import { bookingSettingsSchema } from "../api/shared/schemas";

process.env.FIREBASE_PROJECT_ID = "x";
process.env.FIREBASE_CLIENT_EMAIL = "x";
process.env.FIREBASE_PRIVATE_KEY = "x";

const base = (o: Partial<TokenDoc>): TokenDoc =>
  tokenDocSchema.parse({
    number: "ITS-001",
    seq: 1,
    centreId: "its",
    centreName: "IT Services",
    kind: "booked",
    userId: "u1",
    person: { name: "A", type: "student" },
    serviceName: "Wi-Fi",
    date: "2026-11-16",
    slot: "10:00",
    slotStart: new Date("2026-11-16T04:30:00Z").getTime(),
    status: "COMPLETED",
    createdAt: 1,
    ...o,
  });

const NOW = new Date("2026-11-16T12:00:00Z").getTime();

test("report counts and averages", () => {
  const t = [
    base({ status: "COMPLETED", checkedInAt: 0, calledAt: 4 * 60_000, completedAt: 10 * 60_000 }),
    base({ status: "COMPLETED", checkedInAt: 0, calledAt: 2 * 60_000, completedAt: 8 * 60_000 }),
    base({ status: "NO_SHOW" }),
    base({ status: "CANCELLED" }),
    base({ status: "CHECKED_IN", kind: "walkin", slot: null, slotStart: null, date: "2026-11-17" }),
  ];
  const r = aggregateTokens("its", t, NOW, 15, true);
  assert.equal(r.total, 5);
  assert.equal(r.completed, 2);
  assert.equal(r.noShow, 1);
  assert.equal(r.cancelled, 1);
  assert.equal(r.walkIns, 1);
  assert.equal(r.booked, 4);
  assert.equal(r.noShowRate, 0.25);
  assert.equal(r.avgWaitMinutes, 3);
  assert.equal(r.avgServiceMinutes, 6);
  assert.equal(r.byService?.[0].count, 5);
  assert.equal(r.byDay?.length, 2);
});

test("confidential report has no per-service or per-day detail", () => {
  const r = aggregateTokens("hlt", [base({})], NOW, 15, false);
  assert.equal(r.byService, undefined);
  assert.equal(r.byDay, undefined);
  assert.equal(r.total, 1);
});

test("a confirmed token past its grace time is counted as a no-show", () => {
  const r = aggregateTokens("its", [base({ status: "CONFIRMED" })], NOW, 15, false);
  assert.equal(r.noShow, 1);
});

test("ratings", () => {
  assert.deepEqual(averageRating([]), { average: null, count: 0 });
  assert.deepEqual(averageRating([5, 4, 4]), { average: 4.33, count: 3 });
});

test("all 12 emails render and mention the token", () => {
  assert.equal(EMAIL_TYPES.length, 12);
  for (const type of EMAIL_TYPES) {
    const m = renderEmail(type, {
      name: "Asha",
      tokenNumber: "ITS-014",
      centreName: "IT Services",
      serviceName: "Wi-Fi",
      date: "2026-11-16",
      slot: "10:00",
      appUrl: "https://app.example",
      summary: { total: 9, completed: 6, noShow: 1, cancelled: 1, walkIns: 1 },
    });
    assert.ok(m.subject.length > 0 && m.text.includes("Asha") && m.html.includes("<p>"), type);
    assert.ok(m.text.includes("https://app.example"), type);
  }
  const confirmed = renderEmail("booking_confirmed", { name: "A", tokenNumber: "ITS-014", centreName: "IT Services", serviceName: "Wi-Fi", date: "2026-11-16", slot: "10:00", appUrl: "x" });
  assert.ok(confirmed.text.includes("16 Nov 2026, 10:00-10:30"));
  assert.ok(confirmed.text.includes("Service: Wi-Fi"));
});

test("emails for confidential centres never mention the service", () => {
  const t = base({ confidential: true, serviceName: "Counselling", centreName: "CCHS - Counselor" });
  const data = tokenEmailData(t);
  assert.equal(data.serviceName, null);
  for (const type of EMAIL_TYPES) {
    const m = renderEmail(type, data);
    assert.ok(!m.text.includes("Counselling") && !m.html.includes("Counselling"), type);
  }
});

test("email html escapes names", () => {
  const m = renderEmail("welcome", { name: "<b>x</b>", appUrl: "https://a" });
  assert.ok(!m.html.includes("<b>x</b>"));
  assert.ok(m.html.includes("&lt;b&gt;"));
});

test("email retries: 5 min, 15 min, 1 h, 6 h, 24 h, then failed", () => {
  const now = 1_000_000;
  assert.equal(nextAttempt(1, now).nextAttemptAt, now + 5 * 60_000);
  assert.equal(nextAttempt(2, now).nextAttemptAt, now + 15 * 60_000);
  assert.equal(nextAttempt(3, now).nextAttemptAt, now + 60 * 60_000);
  assert.equal(nextAttempt(4, now).nextAttemptAt, now + 360 * 60_000);
  assert.equal(nextAttempt(5, now).nextAttemptAt, now + 1440 * 60_000);
  assert.equal(nextAttempt(MAX_ATTEMPTS, now).status, "failed");
});

test("student view hides other people's details; staff view shows them", () => {
  const settings = bookingSettingsSchema.parse({});
  const t = { id: "t1", ...base({ status: "CONFIRMED", person: { name: "Asha", type: "student", id: "2543101", mobile: "9876543210", email: "a@x.in", category: null } }) };
  const early = new Date("2026-11-16T02:00:00Z").getTime(); // 07:30 IST, 2.5 h before the slot
  const s = toStudentView(t, early, settings);
  assert.equal(s.canCancel, true);
  assert.equal(s.canCheckIn, false);
  assert.ok(!("person" in s));
  const late = new Date("2026-11-16T04:20:00Z").getTime(); // 09:50 IST, 10 min before
  assert.equal(toStudentView(t, late, settings).canCancel, false);
  assert.equal(toStudentView(t, late, settings).canCheckIn, true);
  assert.equal(toStaffView(t, early, settings).person.name, "Asha");
});
