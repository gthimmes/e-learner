import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { rateLimitBackend } from "@/lib/ratelimit";
import { payments } from "@/lib/payments";
import { aiEnabled, aiProvider } from "@/lib/ai";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

/** GET /api/health — liveness + dependency check for load balancers and uptime monitors (v1.4). */
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let dbError = "";
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }
  const pending = dbOk ? await db.webhookDelivery.count({ where: { state: { in: ["PENDING", "FAILED"] } } }).catch(() => -1) : -1;
  const dead = dbOk ? await db.webhookDelivery.count({ where: { state: "DEAD" } }).catch(() => -1) : -1;
  const body = {
    ok: dbOk,
    version: pkg.version,
    uptimeSec: Math.round(process.uptime()),
    checks: {
      db: { ok: dbOk, error: dbError || undefined, latencyMs: Date.now() - started },
      storage: { kind: storage.kind },
      rateLimit: { backend: rateLimitBackend },
      payments: { provider: payments.name },
      mail: { transport: process.env.SMTP_URL ? "smtp" : "console" },
      ai: { provider: aiProvider.name, enabled: aiEnabled },
      webhooks: { queued: pending, dead },
    },
  };
  return Response.json(body, { status: dbOk ? 200 : 503, headers: { "cache-control": "no-store" } });
}
