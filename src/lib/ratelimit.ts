import "server-only";
import { headers } from "next/headers";

/**
 * Fixed-window in-memory rate limiter for auth endpoints. Per-process only —
 * swap the store for Redis when running more than one instance.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Clears a bucket — call after a successful sign-in so only failures count toward the limit. */
export function rateLimitReset(key: string) {
  buckets.delete(key);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Periodic sweep so the map cannot grow without bound. */
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}, 60_000).unref?.();
