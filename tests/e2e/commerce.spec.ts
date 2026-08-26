import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * v1.0 commerce with the mock payment provider: paid course → coupon → checkout → enrolled →
 * instructor sees the sale → refund removes the enrollment.
 */
test("buy a paid course with a coupon, then refund", async ({ page }) => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const instructor = await db.user.findUniqueOrThrow({ where: { email: "instructor@example.com" } });
  const course = await db.course.create({
    data: {
      slug: `paid-${stamp}`,
      title: `Paid Course ${stamp}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      priceCents: 2000,
      currency: "usd",
      instructorId: instructor.id,
      modules: { create: { title: "M1", position: 0, lessons: { create: { title: "L1", type: "TEXT", position: 0, body: "hi" } } } },
    },
  });
  await db.coupon.create({ data: { code: `HALF${stamp}`, percentOff: 50, courseId: course.id, createdById: instructor.id } });
  const learnerEmail = `buyer-${stamp}@example.com`;

  try {
    // Register a buyer.
    await page.goto("/register");
    await page.getByLabel("Name").fill("Bea Buyer");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/learn/);

    // Landing shows the price; apply coupon and go to (mock) checkout.
    await page.goto(`/courses/${course.slug}`);
    await expect(page.getByText("$20.00").first()).toBeVisible();
    await page.getByLabel("Coupon code").fill(`half${stamp}`);
    await page.getByRole("button", { name: /Buy for/ }).click();
    await page.waitForURL(/\/checkout\/mock\//);
    await expect(page.getByText("$10.00").first()).toBeVisible();
    await page.getByRole("button", { name: /^Pay/ }).click();
    await page.waitForURL(/purchase=success/);
    await expect(page.getByText(/Payment received/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Start course" })).toBeVisible();

    const purchase = await db.purchase.findFirstOrThrow({ where: { courseId: course.id } });
    expect(purchase.status).toBe("PAID");
    expect(purchase.amountCents).toBe(1000);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: `HALF${stamp}` } })).uses).toBe(1);

    // Instructor refunds.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto(`/author/${course.id}/pricing`);
    await expect(page.getByText("Bea Buyer")).toBeVisible();
    await expect(page.getByText("$10.00").first()).toBeVisible();
    await page.getByRole("button", { name: "Refund" }).click();
    await expect(page.getByRole("button", { name: "Refund" })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "Refunded" })).toBeVisible();
    expect(await db.enrollment.count({ where: { courseId: course.id } })).toBe(0);
  } finally {
    await db.course.delete({ where: { id: course.id } });
    await db.user.deleteMany({ where: { email: learnerEmail } });
    await db.$disconnect();
  }
});
