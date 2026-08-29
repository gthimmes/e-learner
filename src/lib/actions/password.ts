"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { appUrl, mailer } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { formStr } from "@/lib/validation";
import type { ActionState } from "./auth";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const RESET_TTL_MIN = 60;

/** Sends a reset link if the account exists; always responds the same way (AUTH-6). */
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = formStr(formData, "email").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };

  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, 5, 15 * 60_000)).ok) return { error: "Too many requests. Try again in a few minutes." };

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.passwordReset.create({
      data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) },
    });
    const link = appUrl(`/reset/${token}`);
    await mailer.send({
      to: email,
      subject: "Reset your e-learner password",
      text: `Hi ${user.name},\n\nSomeone asked to reset the password for this account. Use the link below within ${RESET_TTL_MIN} minutes:\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    });
  }
  return { ok: true };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = formStr(formData, "token");
  const password = formStr(formData, "password");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    db.passwordReset.deleteMany({ where: { userId: reset.userId, usedAt: null } }),
  ]);
  await createSession(reset.userId);
  redirect("/learn");
}
