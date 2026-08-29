import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * v1.3 Engage: completing a lesson earns points, a streak day and the "First step" badge;
 * an instructor announcement lands in the learner's notifications.
 */
test("streak, badge, notifications and announcements", async ({ page }) => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const instructor = await db.user.findUniqueOrThrow({ where: { email: "instructor@example.com" } });
  const course = await db.course.create({
    data: {
      slug: `engage-${stamp}`,
      title: `Engage Course ${stamp}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      instructorId: instructor.id,
      modules: {
        create: {
          title: "M1",
          position: 0,
          lessons: { create: [{ title: "L1", type: "TEXT", position: 0, body: "one" }, { title: "L2", type: "TEXT", position: 1, body: "two" }] },
        },
      },
    },
  });
  const learnerEmail = `engage-${stamp}@example.com`;

  try {
    await page.goto("/register");
    await page.getByLabel("Name").fill("Enna Engaged");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/learn/);
    await expect(page.getByText("0-day streak")).toBeVisible();

    await page.goto(`/courses/${course.slug}`);
    await page.getByRole("button", { name: "Enroll now" }).click();
    await page.waitForURL(new RegExp(`/learn/${course.slug}/`));
    const firstLessonUrl = page.url();
    await page.getByRole("button", { name: /Mark complete & continue/ }).click();
    await page.waitForURL((u) => u.href !== firstLessonUrl && /\/learn\//.test(u.pathname)); // second lesson

    // Profile reflects the completion.
    await page.goto("/me");
    await expect(page.getByText("🔥 1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Badges" })).toBeVisible();
    const firstStep = page.locator("div", { hasText: /^First step/ }).first();
    await expect(firstStep).toBeVisible();
    await expect(page.getByText(/Earned/).first()).toBeVisible();
    const learner = await db.user.findUniqueOrThrow({ where: { email: learnerEmail } });
    expect(learner.points).toBe(10);
    expect(await db.badge.count({ where: { userId: learner.id, key: "FIRST_LESSON" } })).toBe(1);

    // Badge notification is unread.
    await expect(page.getByRole("link", { name: /1 unread notification/ })).toBeVisible();

    // Instructor posts an announcement.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto(`/author/${course.id}/announcements`);
    await page.getByLabel("Title").fill("Heads up");
    await page.getByLabel(/Message/).fill("Office hours **Friday**.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByRole("heading", { name: "Heads up" })).toBeVisible();
    expect(await db.notification.count({ where: { userId: learner.id, type: "announcement" } })).toBe(1);

    // Learner sees it in notifications and on the course page.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await expect(page.getByRole("link", { name: /2 unread notifications/ })).toBeVisible();
    await page.goto("/notifications");
    await expect(page.getByText(/Heads up/)).toBeVisible();
    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    await page.goto(`/courses/${course.slug}`);
    await expect(page.getByRole("heading", { name: "Announcements" })).toBeVisible();
    await expect(page.getByText("Friday")).toBeVisible();
  } finally {
    await db.course.deleteMany({ where: { id: course.id } });
    await db.user.deleteMany({ where: { email: learnerEmail } });
    await db.$disconnect();
  }
});
