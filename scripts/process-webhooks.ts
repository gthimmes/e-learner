/**
 * Retries due webhook deliveries from the outbox. Run from cron (e.g. every 5 minutes):
 *   npx tsx scripts/process-webhooks.ts [--limit 100]
 * Equivalent to calling /api/cron/webhooks with CRON_SECRET.
 */
import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 100;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];

async function main() {
  const due = await db.webhookDelivery.findMany({
    where: { state: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    include: { webhook: true },
  });
  let delivered = 0;
  let dead = 0;
  for (const d of due) {
    const started = Date.now();
    let status = 0;
    let error = "";
    try {
      const sig = "sha256=" + createHmac("sha256", d.webhook.secret).update(d.payload).digest("hex");
      const res = await fetch(d.webhook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-elearner-event": d.event, "x-elearner-signature": sig },
        body: d.payload,
        signal: AbortSignal.timeout(10_000),
      });
      status = res.status;
      if (status < 200 || status >= 300) error = `HTTP ${status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const attempt = d.attempt + 1;
    const ok = status >= 200 && status < 300;
    const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
    const delay = ok ? null : permanent ? undefined : BACKOFF_MS[attempt - 1];
    const state = ok ? "DELIVERED" : delay === undefined ? "DEAD" : "FAILED";
    await db.webhookDelivery.update({
      where: { id: d.id },
      data: { status, durationMs: Date.now() - started, attempt, state, nextAttemptAt: state === "FAILED" ? new Date(Date.now() + delay!) : null, lastError: error.slice(0, 500) },
    });
    if (ok) delivered++;
    if (state === "DEAD") dead++;
    console.log(`${state.padEnd(9)} ${d.event} → ${d.webhook.url} (${status || "ERR"}, attempt ${attempt})`);
  }
  console.log(`${due.length} due · ${delivered} delivered · ${dead} dead-lettered`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
