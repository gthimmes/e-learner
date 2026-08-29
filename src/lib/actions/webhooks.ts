"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { WEBHOOK_EVENTS } from "@/lib/constants";
import { deliver, retryDelivery as retryDeliveryNow } from "@/lib/webhooks";
import { audit } from "@/lib/audit";
import { formStr } from "@/lib/validation";
import type { RosterState } from "./roster";

export async function createWebhook(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const user = await actionAuthor();
  const url = formStr(formData, "url").trim();
  if (!/^https?:\/\//i.test(url)) return { error: "Enter an http(s) URL." };
  const chosen = formData.getAll("events").filter((e): e is string => typeof e === "string" && (WEBHOOK_EVENTS as readonly string[]).includes(e));
  const events = chosen.length === 0 || chosen.length === WEBHOOK_EVENTS.length ? "*" : chosen.join(",");
  const count = await db.webhook.count({ where: { userId: user.id } });
  if (count >= 10) return { error: "You already have 10 webhooks." };
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const hook = await db.webhook.create({ data: { userId: user.id, url, secret, events } });
  await audit(user, "webhook.create", { type: "webhook", id: hook.id }, { url, events });
  revalidatePath("/settings");
  return { message: `Webhook added. Signing secret (save it now): ${secret}` };
}

export async function toggleWebhook(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "webhookId");
  const hook = await db.webhook.findFirst({ where: { id, userId: user.id } });
  if (!hook) throw new Error("Webhook not found.");
  await db.webhook.update({ where: { id }, data: { active: !hook.active } });
  revalidatePath("/settings");
}

export async function deleteWebhook(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "webhookId");
  await db.webhook.deleteMany({ where: { id, userId: user.id } });
  await audit(user, "webhook.delete", { type: "webhook", id });
  revalidatePath("/settings");
}

/** Sends a `webhook.test` event so integrators can verify signatures. */
export async function testWebhook(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "webhookId");
  const hook = await db.webhook.findFirst({ where: { id, userId: user.id } });
  if (!hook) throw new Error("Webhook not found.");
  await deliver(hook, {
    event: "webhook.test",
    occurredAt: new Date().toISOString(),
    course: { id: "test", slug: "test", title: "Test course" },
    user: { id: user.id, email: user.email, name: user.name },
  });
  revalidatePath("/settings");
}

/** Re-queues a failed or dead-lettered delivery and attempts it immediately (v1.4). */
export async function retryDelivery(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "deliveryId");
  const d = await db.webhookDelivery.findFirst({ where: { id, webhook: { userId: user.id } }, select: { id: true } });
  if (!d) throw new Error("Delivery not found.");
  await retryDeliveryNow(d.id);
  revalidatePath("/settings");
}
