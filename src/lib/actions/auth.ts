"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { firstIssue, loginSchema, registerSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export type ActionState = { error?: string; ok?: boolean };

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  // AUTH-5: the first user bootstraps as ADMIN.
  const userCount = await db.user.count();
  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: userCount === 0 ? "ADMIN" : "LEARNER" },
  });
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { email, password } = parsed.data;

  // Brute-force protection: 10 attempts per IP+email per 15 minutes.
  const ip = await clientIp();
  const rl = rateLimit(`login:${ip}:${email}`, 10, 15 * 60_000);
  if (!rl.ok) return { error: `Too many sign-in attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minute(s).` };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
