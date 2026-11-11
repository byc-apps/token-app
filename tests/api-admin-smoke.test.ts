import { test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../api/app";

// Every admin endpoint must refuse anonymous callers before touching any data.
const cases: Array<[string, string]> = [
  ["GET", "/api/centres"],
  ["POST", "/api/centres"],
  ["PATCH", "/api/centres/its"],
  ["GET", "/api/users"],
  ["GET", "/api/users/preregistered"],
  ["POST", "/api/users/preregister"],
  ["GET", "/api/users/abc123"],
  ["PATCH", "/api/users/abc123"],
  ["GET", "/api/departments"],
  ["POST", "/api/departments"],
  ["PATCH", "/api/departments/dep-cs"],
  ["GET", "/api/settings"],
  ["PATCH", "/api/settings"],
  ["PUT", "/api/me/profile"],
  ["PATCH", "/api/me/mobile"],
  ["GET", "/api/centres/its/staff"],
  ["POST", "/api/centres/its/staff"],
  ["DELETE", "/api/centres/its/staff/abc123"],
  ["DELETE", "/api/centres/its/pending/a@christuniversity.in"],
];

for (const [method, path] of cases) {
  test(`${method} ${path} requires sign-in`, async () => {
    const res = await app.request(path, { method });
    assert.equal(res.status, 401);
  });
}
