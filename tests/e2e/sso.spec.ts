import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { startMockIdp } from "../../scripts/mock-oidc.mjs";

/**
 * SSO (AUTH-7): the app must be running with OIDC_ISSUER=http://localhost:3400 and
 * OIDC_CLIENT_ID=e-learner (see .env.example). The mock IdP is started here.
 */
test("sign in with SSO creates the user and starts a session", async ({ page }) => {
  const idp = await startMockIdp(3400, "e-learner");
  const db = new PrismaClient();
  const email = process.env.MOCK_OIDC_EMAIL || "sso@example.com";
  await db.user.deleteMany({ where: { email } });

  try {
    await page.goto("/login");
    await page.getByRole("link", { name: /Sign in with SSO/ }).click();
    await page.waitForURL(/\/learn/);
    await expect(page.getByText("Sam Single-Sign-On")).toBeVisible();

    const user = await db.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("LEARNER");

    // Second sign-in reuses the account.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login?next=/author");
    await page.getByRole("link", { name: /Sign in with SSO/ }).click();
    await page.waitForURL(/\/\?denied=1|\/author/); // learner → denied redirect proves `next` was honoured
    expect(await db.user.count({ where: { email } })).toBe(1);

    await db.user.deleteMany({ where: { email } });
  } finally {
    await db.$disconnect();
    await idp.close();
  }
});
