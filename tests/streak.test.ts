import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, dayKey, shiftDay } from "../src/lib/streak";

test("dayKey and shiftDay use UTC dates", () => {
  assert.equal(dayKey(new Date("2026-08-28T23:59:00Z")), "2026-08-28");
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

test("streak counts consecutive days ending today", () => {
  const s = computeStreak(["2026-08-26", "2026-08-27", "2026-08-28"], "2026-08-28");
  assert.deepEqual(s, { current: 3, longest: 3, activeToday: true });
});

test("streak survives until the end of today when yesterday was active", () => {
  const s = computeStreak(["2026-08-26", "2026-08-27"], "2026-08-28");
  assert.deepEqual(s, { current: 2, longest: 2, activeToday: false });
});

test("a gap resets the current streak but keeps the longest", () => {
  const s = computeStreak(["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-28"], "2026-08-28");
  assert.deepEqual(s, { current: 1, longest: 4, activeToday: true });
});

test("no activity", () => {
  assert.deepEqual(computeStreak([], "2026-08-28"), { current: 0, longest: 0, activeToday: false });
});
