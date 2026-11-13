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
  ["GET", "/api/centres/its/config"],
  ["PATCH", "/api/centres/its/config"],
  ["POST", "/api/centres/its/services"],
  ["PATCH", "/api/centres/its/services/abc"],
  ["POST", "/api/centres/its/counters"],
  ["PATCH", "/api/centres/its/counters/abc"],
  ["GET", "/api/centres/its/slots?date=2026-11-16"],
  ["PUT", "/api/centres/its/slot-days/2026-11-16"],
  ["POST", "/api/tokens"],
  ["GET", "/api/me/tokens"],
  ["GET", "/api/me/tokens/abc"],
  ["POST", "/api/me/tokens/abc/cancel"],
  ["POST", "/api/me/tokens/abc/check-in"],
  ["POST", "/api/me/tokens/abc/feedback"],
  ["PATCH", "/api/me/email-prefs"],
  ["GET", "/api/centres/its/tokens?date=2026-11-16"],
  ["POST", "/api/tokens/abc/approve"],
  ["POST", "/api/tokens/abc/reject"],
  ["POST", "/api/tokens/abc/cancel"],
  ["PATCH", "/api/tokens/abc"],
  ["POST", "/api/tokens/abc/check-in"],
  ["POST", "/api/tokens/abc/close"],
  ["POST", "/api/tokens/abc/transfer"],
  ["POST", "/api/tokens/abc/notes"],
  ["GET", "/api/centres/its/queue"],
  ["POST", "/api/centres/its/queue/call-next"],
  ["POST", "/api/centres/its/walkins"],
  ["GET", "/api/centres/its/display"],
  ["GET", "/api/centres/its/feedback"],
  ["GET", "/api/reports/summary?from=2026-11-01&to=2026-11-16"],
  ["GET", "/api/me/activity?from=2026-11-01&to=2026-11-16"],
  ["GET", "/api/audit-logs"],
  ["GET", "/api/email-log"],
  ["POST", "/api/email-log/abc/resend"],
];

for (const [method, path] of cases) {
  test(`${method} ${path} requires sign-in`, async () => {
    const res = await app.request(path, { method });
    assert.equal(res.status, 401);
  });
}
