import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../api/lib/errors";
import { planUserUpdate, removesActiveAdmin } from "../api/services/user-rules";
import type { UserWithId } from "../api/shared/schemas";

const user = (o: Partial<UserWithId>): UserWithId => ({
  uid: "u1",
  email: "a@christuniversity.in",
  name: "A",
  role: "student_faculty",
  status: "active",
  verified: true,
  userType: null,
  centreIds: [],
  primaryCentreId: null,
  regNo: null,
  empId: null,
  department: null,
  mobile: null,
  ...o,
});

const admin = user({ uid: "admin1", role: "app_admin" });
const authority = user({ uid: "auth1", role: "campus_authority" });

function status(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.status : -1;
  }
  return undefined;
}

test("nobody can change their own role or disable themselves", () => {
  assert.equal(status(() => planUserUpdate(admin, admin, { role: "student_faculty" }, 1)), 403);
  assert.equal(status(() => planUserUpdate(admin, admin, { status: "disabled" }, 1)), 403);
});

test("Campus Authority cannot grant, remove or disable the App Admin role", () => {
  const student = user({ uid: "s1" });
  assert.equal(status(() => planUserUpdate(authority, student, { role: "app_admin" })), 403);
  assert.equal(status(() => planUserUpdate(authority, admin, { role: "campus_authority" }, 1)), 403);
  assert.equal(status(() => planUserUpdate(authority, admin, { status: "disabled" }, 1)), 403);
});

test("Campus Authority has full edit rights otherwise", () => {
  const student = user({ uid: "s1" });
  const plan = planUserUpdate(authority, student, { role: "campus_authority", verified: true });
  assert.deepEqual(plan.changedFields, ["role"]);
});

test("App Admin can grant App Admin", () => {
  const student = user({ uid: "s1" });
  const plan = planUserUpdate(admin, student, { role: "app_admin" });
  assert.deepEqual(plan.changedFields, ["role"]);
});

test("the last active App Admin cannot be demoted or disabled", () => {
  const other = user({ uid: "admin2", role: "app_admin" });
  assert.ok(removesActiveAdmin(other, { role: "campus_authority" }));
  assert.ok(removesActiveAdmin(other, { status: "disabled" }));
  assert.ok(!removesActiveAdmin(other, { name: "New name" }));
  assert.equal(status(() => planUserUpdate(admin, other, { status: "disabled" }, 0)), 409);
  assert.equal(status(() => planUserUpdate(admin, other, { status: "disabled" }, 1)), undefined);
});

test("centre roles need a centre; first one becomes the primary", () => {
  const student = user({ uid: "s1" });
  assert.equal(status(() => planUserUpdate(admin, student, { role: "centre_staff" })), 400);
  const plan = planUserUpdate(admin, student, { role: "centre_staff", centreIds: ["its", "acc"] });
  assert.equal(plan.changes.primaryCentreId, "its");
  assert.deepEqual(plan.changes.centreIds, ["its", "acc"]);
});

test("explicit primary must be one of the assigned centres", () => {
  const student = user({ uid: "s1" });
  assert.equal(
    status(() =>
      planUserUpdate(admin, student, {
        role: "centre_admin",
        centreIds: ["its"],
        primaryCentreId: "acc",
      }),
    ),
    400,
  );
  const plan = planUserUpdate(admin, student, {
    role: "centre_admin",
    centreIds: ["its", "acc"],
    primaryCentreId: "acc",
  });
  assert.equal(plan.changes.primaryCentreId, "acc");
});

test("only centre roles can hold centres; leaving a centre role clears them", () => {
  const student = user({ uid: "s1" });
  assert.equal(status(() => planUserUpdate(admin, student, { centreIds: ["its"] })), 400);
  const staff = user({ uid: "s2", role: "centre_staff", centreIds: ["its"], primaryCentreId: "its" });
  const plan = planUserUpdate(admin, staff, { role: "student_faculty" });
  assert.deepEqual(plan.changes.centreIds, []);
  assert.equal(plan.changes.primaryCentreId, null);
});

test("disabling is flagged so tokens get revoked; no-op changes are empty", () => {
  const student = user({ uid: "s1" });
  assert.equal(planUserUpdate(admin, student, { status: "disabled" }).disables, true);
  assert.deepEqual(planUserUpdate(admin, student, { name: "A" }).changedFields, []);
});
