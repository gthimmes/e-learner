import "server-only";
import { headers } from "next/headers";
import { log } from "./log";

/**
 * Fixed-window rate limiter for auth endpoints. In-memory per process by default; shared
 * across instances through Redis when `REDIS_URL` is set (v1.4).
 */
export interface RateLimitStore {
  /** Increments the counter for `key`, starting a window of `windowMs` if none is active. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [k, b] of this.buckets) if (b.resetAt < now) this.buckets.delete(k);
    }, 60_000).unref?.();
  }
  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt < now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    b.count++;
    return b;
  }
  async reset(key: string) {
    this.buckets.delete(key);
  }
}

class RedisStore implements RateLimitStore {
  private client: import("ioredis").Redis | null = null;
  private fallback = new MemoryStore();
  constructor(private url: string) {}
  private async redis() {
    if (this.client) return this.client;
    const { default: Redis } = await import("ioredis");
    this.client = new Redis(this.url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
    this.client.on("error", (e) => log.warn("redis error", { error: e.message }));
    await this.client.connect().catch(() => {});
    return this.client;
  }
  async hit(key: string, windowMs: number) {
    try {
      const r = await this.redis();
      const k = `rl:${key}`;
      const [[, count], [, ttl]] = (await r.multi().incr(k).pttl(k).exec()) as [[null, number], [null, number]];
      let remaining = ttl;
      if (ttl < 0) {
        await r.pexpire(k, windowMs);
        remaining = windowMs;
      }
      return { count, resetAt: Date.now() + remaining };
    } catch (e) {
      log.warn("redis rate limit unavailable, using memory", { error: e instanceof Error ? e.message : String(e) });
      return this.fallback.hit(key, windowMs);
    }
  }
  async reset(key: string) {
    try {
      const r = await this.redis();
      await r.del(`rl:${key}`);
    } catch {
      await this.fallback.reset(key);
    }
  }
}

const store: RateLimitStore = process.env.REDIS_URL ? new RedisStore(process.env.REDIS_URL) : new MemoryStore();
export const rateLimitBackend = process.env.REDIS_URL ? "redis" : "memory";

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const { count, resetAt } = await store.hit(key, windowMs);
  if (count > limit) return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) };
  return { ok: true, remaining: limit - count, retryAfterSec: 0 };
}

/** Clears a bucket — call after a successful sign-in so only failures count toward the limit. */
export async function rateLimitReset(key: string) {
  await store.reset(key);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
