import { test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../api/app";

test("GET /api/health is public", async () => {
  const res = await app.request("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.ok(res.headers.get("x-request-id"));
});

test("GET /api/me without a token is 401", async () => {
  const res = await app.request("/api/me");
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "UNAUTHENTICATED");
});

test("POST /api/auth/login without a token is 401", async () => {
  const res = await app.request("/api/auth/login", { method: "POST" });
  assert.equal(res.status, 401);
});

test("unknown route is a clean 404", async () => {
  const res = await app.request("/api/nope");
  assert.equal(res.status, 404);
});

test("oversized body is rejected", async () => {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-length": String(1024 * 1024) },
    body: "x".repeat(1024 * 1024),
  });
  assert.equal(res.status, 413);
});
