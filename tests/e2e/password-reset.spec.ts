import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/** Password reset (AUTH-6): request → (token from DB, since dev mail goes to the console) → set password → sign in. */
test("forgot / reset password", async ({ page }) => {
  const db = new PrismaClient();
  const email = `reset-${Date.now()}@example.com`;
  const user = await db.user.create({ data: { email, name: "Reset Tester", passwordHash: "x" } });

  // The request form always reports success (no account enumeration).
  await page.goto("/forgot");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
  const created = await db.passwordReset.count({ where: { userId: user.id } });
  expect(created).toBe(1);

  // Use a token we control (the emailed one is hashed at rest).
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({
    data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) },
  });
  await page.goto(`/reset/${token}`);
  await page.getByLabel("New password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Set new password" }).click();
  await page.waitForURL(/\/learn/);

  // Token is single-use.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto(`/reset/${token}`);
  await page.getByLabel("New password").fill("another-pass-123");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();

  // New password works.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/learn/);

  await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
});
