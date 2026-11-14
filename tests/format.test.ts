import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatDateKey, formatTime, formatTimeKey } from "../src/lib/format";

test("formats date values in India time", () => {
  assert.equal(formatDate(new Date("2026-11-15T20:00:00.000Z")), "16 Nov 2026");
});

test("formats India date keys", () => {
  assert.equal(formatDateKey("2026-11-16"), "16 Nov 2026");
});

test("formats times in 12-hour India time", () => {
  assert.equal(formatTime(new Date("2026-11-15T05:00:00.000Z")), "10:30 am");
  assert.equal(formatTimeKey("13:05"), "1:05 pm");
});

test("rejects malformed time keys", () => {
  assert.throws(() => formatTimeKey("24:00"), RangeError);
});
