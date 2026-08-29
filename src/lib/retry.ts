/** Retry policy for webhook deliveries (pure, unit-tested). */

/** Wait before attempt 2, 3, 4, 5, 6. After the last failure the delivery is dead-lettered. */
export const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000] as const;
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

/** Delay before the next attempt after `attemptsSoFar` failures, or null when the delivery should be dead-lettered. */
export function nextRetryDelayMs(attemptsSoFar: number): number | null {
  if (attemptsSoFar < 1) return 0;
  const delay = BACKOFF_MS[attemptsSoFar - 1];
  return delay === undefined ? null : delay;
}

export function isDeliveredStatus(status: number) {
  return status >= 200 && status < 300;
}

/** 4xx (except 408/429) will not succeed on retry; treat as dead immediately. */
export function isPermanentFailure(status: number) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
