import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission, isGlobalRole, ROLES, PERMISSIONS } from "../shared/roles";
import { isAllowedEmail } from "../shared/email";
import { istDateKey, istDateTime, istWeekday } from "../shared/time";

test("permission matrix", () => {
  assert.ok(hasPermission("app_admin", "users:manage"));
  assert.ok(hasPermission("campus_authority", "centres:manage")); // edit rights
  assert.ok(hasPermission("centre_admin", "centre:configure"));
  assert.ok(!hasPermission("centre_admin", "centres:manage"));
  assert.ok(!hasPermission("centre_admin", "users:manage"));
  assert.ok(hasPermission("centre_staff", "tokens:serve"));
  assert.ok(!hasPermission("centre_staff", "tokens:manage"));
  assert.ok(!hasPermission("centre_staff", "reports:centre"));
  assert.ok(hasPermission("student_faculty", "tokens:book"));
  assert.ok(hasPermission("student_faculty", "feedback:give"));
});

test("students/faculty hold no admin-side permission", () => {
  const adminSide = PERMISSIONS.filter(
    (p) => !["tokens:book", "tokens:cancel_own", "feedback:give"].includes(p),
  );
  for (const p of adminSide) assert.ok(!hasPermission("student_faculty", p), p);
});

test("global roles", () => {
  assert.deepEqual(ROLES.filter(isGlobalRole), ["app_admin", "campus_authority"]);
});

test("email domain is strict", () => {
  assert.ok(isAllowedEmail("a@christuniversity.in"));
  assert.ok(isAllowedEmail("A@Student.ChristUniversity.in"));
  assert.ok(!isAllowedEmail("a@evilchristuniversity.in"));
  assert.ok(!isAllowedEmail("a@christuniversity.in.evil.com"));
  assert.ok(!isAllowedEmail("a@gmail.com"));
  assert.ok(!isAllowedEmail("a/b@christuniversity.in"));
  assert.ok(!isAllowedEmail(""));
  assert.ok(!isAllowedEmail(null));
});

test("IST helpers", () => {
  assert.equal(istDateTime("2026-11-02", "08:30").toISOString(), "2026-11-02T03:00:00.000Z");
  assert.equal(istWeekday("2026-11-02"), 1); // Monday
  assert.equal(istDateKey(new Date("2026-11-01T20:00:00Z")), "2026-11-02"); // 01:30 IST next day
  assert.throws(() => istDateTime("2026-02-31", "08:30"));
  assert.throws(() => istDateTime("2026-11-02", "25:00"));
});
