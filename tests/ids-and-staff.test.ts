import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../api/lib/errors";
import { planAdd, planRemove } from "../api/services/staff-rules";
import { centreIdFor, tokenPrefixFor } from "../api/shared/centres";
import { DEFAULT_ID_FORMATS, checkId, isProfileComplete } from "../api/shared/ids";
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
  departmentId: null,
  mobile: null,
  ...o,
});
const admin = user({ uid: "adm", role: "app_admin" });
const authority = user({ uid: "auth", role: "campus_authority" });
const centreAdmin = user({ uid: "ca", role: "centre_admin", centreIds: ["its"], primaryCentreId: "its" });

function status(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.status : -1;
  }
  return undefined;
}

test("Register No. is exactly 7 digits", () => {
  const f = DEFAULT_ID_FORMATS;
  assert.deepEqual(checkId("student", " 2543101 ", f), { ok: true, id: "2543101" });
  for (const bad of ["254310", "25431011", "25431A1", "", "25 43101"]) {
    assert.equal(checkId("student", bad, f).ok, false, bad);
  }
});

test("Employee ID is 3-6 letters/digits", () => {
  const f = DEFAULT_ID_FORMATS;
  assert.deepEqual(checkId("faculty", "1414", f), { ok: true, id: "1414" });
  assert.deepEqual(checkId("faculty", "ab123", f), { ok: true, id: "AB123" });
  for (const bad of ["12", "1234567", "12-34", "12 34"]) {
    assert.equal(checkId("faculty", bad, f).ok, false, bad);
  }
});

test("formats come from settings, not code", () => {
  const custom = { ...DEFAULT_ID_FORMATS, student: { charset: "digits" as const, minLength: 8, maxLength: 8 } };
  assert.equal(checkId("student", "2543101", custom).ok, false);
  assert.equal(checkId("student", "25431011", custom).ok, true);
});

test("profile is complete only with type, ID, department and mobile", () => {
  const base = { userType: "student" as const, regNo: "2543101", empId: null, departmentId: "dep-cs", mobile: "9876543210" };
  assert.ok(isProfileComplete(base));
  assert.ok(!isProfileComplete({ ...base, mobile: null }));
  assert.ok(!isProfileComplete({ ...base, departmentId: null }));
  assert.ok(!isProfileComplete({ ...base, regNo: null }));
  assert.ok(!isProfileComplete({ ...base, userType: null }));
});

test("department desks get dep- ids and DEP- token prefixes", () => {
  assert.equal(centreIdFor("department", "CS"), "dep-cs");
  assert.equal(tokenPrefixFor("department", "CS"), "DEP-CS");
  assert.equal(centreIdFor("centre", "ITS"), "its");
  assert.equal(tokenPrefixFor("centre", "ITS"), "ITS");
});

test("Centre Admin can add staff, never another Centre Admin", () => {
  assert.equal(status(() => planAdd(centreAdmin, null, "centre_admin", "its")), 403);
  const plan = planAdd(centreAdmin, null, "centre_staff", "its");
  assert.deepEqual(plan, { role: "centre_staff", centreIds: ["its"], primaryCentreId: "its" });
});

test("adding an existing student makes them staff of that centre", () => {
  const student = user({ uid: "s1" });
  const plan = planAdd(centreAdmin, student, "centre_staff", "its");
  assert.equal(plan.role, "centre_staff");
  assert.deepEqual(plan.centreIds, ["its"]);
});

test("adding to a second centre keeps the first as primary", () => {
  const staff = user({ uid: "st", role: "centre_staff", centreIds: ["acc"], primaryCentreId: "acc" });
  const plan = planAdd(admin, staff, "centre_staff", "its");
  assert.deepEqual(plan.centreIds, ["acc", "its"]);
  assert.equal(plan.primaryCentreId, "acc");
});

test("protected people cannot be added as staff", () => {
  assert.equal(status(() => planAdd(admin, authority, "centre_staff", "its")), 409);
  assert.equal(status(() => planAdd(admin, user({ status: "disabled" }), "centre_staff", "its")), 409);
  const already = user({ role: "centre_staff", centreIds: ["its"], primaryCentreId: "its" });
  assert.equal(status(() => planAdd(centreAdmin, already, "centre_staff", "its")), 409);
});

test("a Centre Admin elsewhere cannot be added as staff by a Centre Admin", () => {
  const otherAdmin = user({ uid: "oa", role: "centre_admin", centreIds: ["acc"], primaryCentreId: "acc" });
  assert.equal(status(() => planAdd(centreAdmin, otherAdmin, "centre_staff", "its")), 403);
  assert.equal(status(() => planAdd(admin, otherAdmin, "centre_staff", "its")), 409);
  const plan = planAdd(admin, otherAdmin, "centre_admin", "its");
  assert.equal(plan.role, "centre_admin");
  assert.deepEqual(plan.centreIds, ["acc", "its"]);
});

test("removal rules", () => {
  const staff = user({ uid: "st", role: "centre_staff", centreIds: ["its", "acc"], primaryCentreId: "its" });
  const afterOne = planRemove(centreAdmin, staff, "its", false);
  assert.deepEqual(afterOne, { role: "centre_staff", centreIds: ["acc"], primaryCentreId: "acc" });

  const lastCentre = user({ uid: "st", role: "centre_staff", centreIds: ["its"], primaryCentreId: "its" });
  const afterAll = planRemove(centreAdmin, lastCentre, "its", false);
  assert.deepEqual(afterAll, { role: "student_faculty", centreIds: [], primaryCentreId: null });

  assert.equal(status(() => planRemove(centreAdmin, staff, "zzz", false)), 404);
  assert.equal(status(() => planRemove(centreAdmin, centreAdmin, "its", true)), 403);
  const peerAdmin = user({ uid: "pa", role: "centre_admin", centreIds: ["its"], primaryCentreId: "its" });
  assert.equal(status(() => planRemove(centreAdmin, peerAdmin, "its", false)), 403);
  assert.equal(status(() => planRemove(admin, peerAdmin, "its", false)), undefined);
});
