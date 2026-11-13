/**
 * Runs only against the Firestore emulator:
 *   firebase emulators:exec --only firestore --project demo-token "npm run test:emulator"
 * Skipped when FIRESTORE_EMULATOR_HOST is not set.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
process.env.FIREBASE_PROJECT_ID = "demo-token";
process.env.FIREBASE_CLIENT_EMAIL = "x@demo-token.iam.gserviceaccount.com";
process.env.FIREBASE_PRIVATE_KEY = "x";

test("booking and queue are safe under parallel requests", { skip: !emulator }, async () => {
  const { initializeApp } = await import("firebase-admin/app");
  initializeApp({ projectId: "demo-token" });
  const { adminDb } = await import("../api/lib/firebase-admin");
  const { createBooking } = await import("../api/services/booking");
  const { callNext, createWalkIn } = await import("../api/services/queue");
  const { addDays, istDateKey, istWeekday } = await import("../api/shared/time");
  type U = import("../api/shared/schemas").UserWithId;

  const db = adminDb();
  await db.collection("centres").doc("its").set({
    name: "IT Services",
    code: "ITS",
    kind: "centre",
    active: true,
    confidential: false,
    services: [{ id: "s1", name: "Wi-Fi", active: true }],
    counters: [
      { id: "c1", name: "Counter 1", active: true },
      { id: "c2", name: "Counter 2", active: true },
    ],
  });

  const person = (i: number): U => ({
    uid: `user${i}`,
    email: `user${i}@christuniversity.in`,
    name: `User ${i}`,
    role: "student_faculty",
    status: "active",
    verified: true,
    userType: "student",
    centreIds: [],
    primaryCentreId: null,
    regNo: String(2540000 + i),
    empId: null,
    departmentId: "dep-cs",
    mobile: "9876543210",
    emailPrefs: { reminders: true, feedbackRequests: true },
  });
  const admin: U = { ...person(0), uid: "admin", role: "app_admin" };

  // next weekday (Mon-Fri) inside the booking window
  let date = addDays(istDateKey(), 1);
  while ([0, 6].includes(istWeekday(date))) date = addDays(date, 1);

  // 1. 20 people book the same slot at the same time: exactly 6 get it.
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) =>
      createBooking(person(i + 1), { centreId: "its", serviceId: "s1", date, slot: "10:00" }, "r"),
    ),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  assert.equal(ok.length, 6);
  const numbers = ok.map((r) => (r as PromiseFulfilledResult<{ number: string }>).value.number);
  assert.equal(new Set(numbers).size, 6);
  const day = await db.collection("slotDays").doc(`its_${date}`).get();
  assert.equal(day.data()?.counts["1000"], 6);

  // 2. The same person cannot hold two tokens for one centre and day.
  const same = await Promise.allSettled([
    createBooking(person(99), { centreId: "its", serviceId: "s1", date, slot: "11:00" }, "r"),
    createBooking(person(99), { centreId: "its", serviceId: "s1", date, slot: "11:30" }, "r"),
  ]);
  assert.equal(same.filter((r) => r.status === "fulfilled").length, 1);

  // 3. Parallel walk-ins get different numbers.
  const walk = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      createWalkIn(admin, "its", { kind: "visitor", name: `Guest ${i}`, mobile: "9876543210", category: "guest", serviceId: "s1" }, "r"),
    ),
  );
  assert.equal(new Set(walk.map((w) => w.token.number)).size, 10);

  // 4. Two counters call at once: nobody is served twice.
  const [a, b] = await Promise.all([callNext(admin, "its", "c1", "r"), callNext(admin, "its", "c2", "r")]);
  assert.ok(a.token && b.token);
  assert.notEqual(a.token.id, b.token.id);
});
