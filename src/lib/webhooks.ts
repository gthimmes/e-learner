import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { canEditCourse, accessSelect } from "./courses";
import type { Role } from "./constants";
import { sendToLrs, statementFor, type XapiEvent } from "./xapi";

export type WebhookEvent = "enrollment.created" | "lesson.completed" | "course.completed" | "quiz.attempted" | "webhook.test";

export type EventPayload = {
  event: WebhookEvent;
  occurredAt: string;
  course: { id: string; slug: string; title: string };
  user: { id: string; email: string; name: string };
  lesson?: { id: string; title: string };
  quiz?: { attemptId: string; score: number; passed: boolean };
};

export function sign(secret: string, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/** Delivers one event to one webhook and logs the result. Never throws. */
export async function deliver(webhook: { id: string; url: string; secret: string }, payload: EventPayload) {
  const body = JSON.stringify(payload);
  const started = Date.now();
  let status = 0;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-elearner-event": payload.event, "x-elearner-signature": sign(webhook.secret, body) },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    status = res.status;
  } catch {
    status = 0;
  }
  await db.webhookDelivery.create({ data: { webhookId: webhook.id, event: payload.event, status, durationMs: Date.now() - started } }).catch(() => {});
  return status;
}

/**
 * Emits a course event: notifies every active webhook whose owner may edit the course and
 * whose subscription includes the event, and forwards an xAPI statement to the LRS if configured.
 * Fire-and-forget; safe to call from server actions.
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
    void Promise.allSettled(targets.map((h) => deliver(h, payload)));
    void sendToLrs(statementFor(event as XapiEvent, { ...payload, event: event as XapiEvent }));
  } catch (e) {
    console.error("emitEvent failed", e);
  }
}
