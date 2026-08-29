import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKOFF_MS, MAX_ATTEMPTS, isDeliveredStatus, isPermanentFailure, nextRetryDelayMs } from "../src/lib/retry";

test("backoff schedule grows and dead-letters after the last step", () => {
  assert.equal(nextRetryDelayMs(0), 0);
  assert.equal(nextRetryDelayMs(1), 60_000);
  assert.equal(nextRetryDelayMs(2), 5 * 60_000);
  assert.equal(nextRetryDelayMs(5), 12 * 3_600_000);
  assert.equal(nextRetryDelayMs(6), null);
  assert.equal(MAX_ATTEMPTS, BACKOFF_MS.length + 1);
  for (let i = 1; i < BACKOFF_MS.length; i++) assert.ok(BACKOFF_MS[i]! > BACKOFF_MS[i - 1]!);
});

test("status classification", () => {
  assert.equal(isDeliveredStatus(200), true);
  assert.equal(isDeliveredStatus(204), true);
  assert.equal(isDeliveredStatus(302), false);
  assert.equal(isPermanentFailure(404), true);
  assert.equal(isPermanentFailure(410), true);
  assert.equal(isPermanentFailure(429), false);
  assert.equal(isPermanentFailure(408), false);
  assert.equal(isPermanentFailure(503), false);
  assert.equal(isPermanentFailure(0), false);
});
