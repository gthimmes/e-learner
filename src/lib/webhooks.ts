import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { canEditCourse, accessSelect } from "./courses";
import type { Role } from "./constants";
import { sendToLrs, statementFor, type XapiEvent } from "./xapi";
import { isDeliveredStatus, isPermanentFailure, nextRetryDelayMs } from "./retry";
import { log } from "./log";

export type WebhookEvent = "enrollment.created" | "lesson.completed" | "course.completed" | "quiz.attempted" | "quiz.graded" | "webhook.test";

export type EventPayload = {
  event: WebhookEvent;
  occurredAt: string;
  course: { id: string; slug: string; title: string };
  user: { id: string; email: string; name: string };
  lesson?: { id: string; title: string };
  quiz?: { attemptId: string; score: number; passed: boolean; pending?: number };
};

export function sign(secret: string, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/** One HTTP attempt. Returns the status (0 = network error / timeout) and duration. */
async function post(webhook: { url: string; secret: string }, event: string, body: string) {
  const started = Date.now();
  let status = 0;
  let error = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-elearner-event": event, "x-elearner-signature": sign(webhook.secret, body) },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    status = res.status;
    if (!isDeliveredStatus(status)) error = `HTTP ${status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return { status, durationMs: Date.now() - started, error };
}

// ---------- Outbox (v1.4): every delivery is a row that is retried with backoff ----------

/** Queues a payload for a webhook; the first attempt happens right away via `attemptDelivery`. */
export async function enqueue(webhookId: string, payload: EventPayload) {
  return db.webhookDelivery.create({
    data: { webhookId, event: payload.event, status: 0, state: "PENDING", attempt: 0, nextAttemptAt: new Date(), payload: JSON.stringify(payload) },
  });
}

/** Performs one attempt for a queued delivery and schedules the next one (or dead-letters it). */
export async function attemptDelivery(deliveryId: string) {
  const d = await db.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } });
  if (!d || d.state === "DELIVERED" || d.state === "DEAD") return d;
  if (!d.webhook.active) {
    return db.webhookDelivery.update({ where: { id: d.id }, data: { state: "DEAD", lastError: "Webhook paused", nextAttemptAt: null } });
  }
  const r = await post(d.webhook, d.event, d.payload);
  const attempts = d.attempt + 1;
  let state = "DELIVERED";
  let nextAttemptAt: Date | null = null;
  if (!isDeliveredStatus(r.status)) {
    const delay = isPermanentFailure(r.status) ? null : nextRetryDelayMs(attempts);
    if (delay === null) state = "DEAD";
    else {
      state = "FAILED";
      nextAttemptAt = new Date(Date.now() + delay);
    }
  }
  const updated = await db.webhookDelivery.update({
    where: { id: d.id },
    data: { status: r.status, durationMs: r.durationMs, attempt: attempts, state, nextAttemptAt, lastError: r.error.slice(0, 500) },
  });
  log[state === "DELIVERED" ? "info" : "warn"]("webhook delivery", { deliveryId: d.id, event: d.event, status: r.status, attempt: attempts, state, url: d.webhook.url });
  return updated;
}

/** Retries every due delivery (called after events, from the cron route, or from the script). */
export async function processWebhookQueue(limit = 50) {
  const due = await db.webhookDelivery.findMany({
    where: { state: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const summary = { processed: 0, delivered: 0, failed: 0, dead: 0 };
  for (const { id } of due) {
    const r = await attemptDelivery(id);
    summary.processed++;
    if (r?.state === "DELIVERED") summary.delivered++;
    else if (r?.state === "DEAD") summary.dead++;
    else summary.failed++;
  }
  return summary;
}

/** Puts a failed / dead delivery back in the queue and tries immediately. */
export async function retryDelivery(deliveryId: string) {
  await db.webhookDelivery.update({ where: { id: deliveryId }, data: { state: "PENDING", nextAttemptAt: new Date(), attempt: 0, lastError: "" } });
  return attemptDelivery(deliveryId);
}

/** Immediate one-off delivery (used by "Send test"): queued like everything else, then attempted. */
export async function deliver(webhook: { id: string; url: string; secret: string }, payload: EventPayload) {
  const d = await enqueue(webhook.id, payload);
  const r = await attemptDelivery(d.id);
  return r?.status ?? 0;
}

/**
 * Emits a course event: queues a delivery for every active webhook whose owner may edit the
 * course and whose subscription includes the event, attempts them right away, drains any due
 * retries, and forwards an xAPI statement to the LRS if configured. Fire-and-forget.
 */
export async function emitEvent(
  event: Exclude<WebhookEvent, "webhook.test">,
  courseId: string,
  userId: string,
  extra: { lesson?: { id: string; title: string }; quiz?: EventPayload["quiz"] } = {},
) {
  try {
    const [course, user, hooks] = await Promise.all([
      db.course.findUnique({ where: { id: courseId }, select: { ...accessSelect, title: true } }),
      db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
      db.webhook.findMany({
        where: { active: true },
        include: { user: { select: { id: true, email: true, name: true, role: true, organizationId: true, orgAdmin: true } } },
      }),
    ]);
    if (!course || !user) return;
    const payload: EventPayload = {
      event,
      occurredAt: new Date().toISOString(),
      course: { id: course.id, slug: course.slug, title: course.title },
      user,
      ...extra,
    };
    const targets = hooks.filter((h) => {
      const subscribed = h.events === "*" || h.events.split(",").map((s) => s.trim()).includes(event);
      return subscribed && canEditCourse({ ...h.user, role: h.user.role as Role }, course);
    });
    const queued = await Promise.all(targets.map((h) => enqueue(h.id, payload)));
    void Promise.allSettled(queued.map((d) => attemptDelivery(d.id))).then(() => processWebhookQueue(20));
    void sendToLrs(statementFor(event as XapiEvent, { ...payload, event: event as XapiEvent }));
  } catch (e) {
    log.error("emitEvent failed", { event, courseId, error: e instanceof Error ? e.message : String(e) });
  }
}
