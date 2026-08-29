import { processWebhookQueue } from "@/lib/webhooks";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/cron/webhooks — retries due webhook deliveries. Protect with `CRON_SECRET`
 * (send `Authorization: Bearer <secret>`); call it every few minutes from any scheduler.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET is not configured." }, 404);
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return json({ error: "Unauthorized" }, 401);
  const summary = await processWebhookQueue(Number(new URL(req.url).searchParams.get("limit") || 100));
  return json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
