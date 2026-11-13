import { test } from "node:test";
import assert from "node:assert/strict";

test("jobs endpoint needs the secret", async () => {
  process.env.FIREBASE_PROJECT_ID = "x";
  process.env.FIREBASE_CLIENT_EMAIL = "x";
  process.env.FIREBASE_PRIVATE_KEY = "x";
  process.env.CRON_SECRET = "a-long-secret-for-the-tests";
  const { app } = await import("../api/app");

  assert.equal((await app.request("/api/jobs/tick")).status, 401);
  assert.equal(
    (await app.request("/api/jobs/tick", { method: "POST", headers: { "x-cron-secret": "wrong-wrong-wrong-wrong" } })).status,
    403,
  );
  assert.equal((await app.request("/api/jobs/tick", { headers: { authorization: "Bearer nope" } })).status, 403);
});
