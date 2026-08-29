import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * v1.1 discovery: instructor builds a learning path from two courses → learner searches the
 * catalog by keyword and tag, starts the path, and reviews a course.
 */
test("search, learning path and reviews", async ({ page }) => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const instructor = await db.user.findUniqueOrThrow({ where: { email: "instructor@example.com" } });
  const mk = (n: number) =>
    db.course.create({
      data: {
        slug: `disc-${stamp}-${n}`,
        title: `Discover Course ${stamp} ${n}`,
        summary: n === 1 ? "Zebra stripes for beginners" : "Advanced zebra husbandry",
        tags: n === 1 ? `zebra${stamp},beginner` : `zebra${stamp}`,
        level: n === 1 ? "BEGINNER" : "ADVANCED",
        status: "PUBLISHED",
        publishedAt: new Date(),
        instructorId: instructor.id,
        modules: { create: { title: "M1", position: 0, lessons: { create: { title: "L1", type: "TEXT", position: 0, body: "hi" } } } },
      },
    });
  const c1 = await mk(1);
  const c2 = await mk(2);
  const learnerEmail = `disc-${stamp}@example.com`;

  try {
    // Instructor builds a path.
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto("/author/paths/new");
    await page.getByLabel("Title").fill(`Zebra Path ${stamp}`);
    await page.getByRole("button", { name: "Create path" }).click();
    await page.waitForURL(/\/author\/paths\/[a-z0-9]+$/);
    for (const c of [c1, c2]) {
      await page.getByLabel("Course", { exact: true }).selectOption(c.id);
      await page.getByRole("button", { name: "Add" }).click();
      await expect(page.getByRole("link", { name: c.title })).toBeVisible();
    }
    await page.getByRole("button", { name: "Publish path" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");

    // Learner registers and searches.
    await page.goto("/register");
    await page.getByLabel("Name").fill("Dee Discoverer");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/learn/);

    await page.goto("/");
    await page.getByLabel("Search courses").fill("zebra husbandry");
    await page.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/q=zebra/);
    await expect(page.getByRole("link", { name: new RegExp(c2.title) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(c1.title) })).toHaveCount(0);

    // Tag chip narrows to both zebra courses; level filter narrows to one.
    await page.goto(`/?tag=zebra${stamp}`);
    await expect(page.getByRole("link", { name: new RegExp(c1.title) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(c2.title) })).toBeVisible();
    await page.goto(`/?tag=zebra${stamp}&level=ADVANCED`);
    await expect(page.getByRole("link", { name: new RegExp(c1.title) })).toHaveCount(0);
    await expect(page.getByRole("link", { name: new RegExp(c2.title) })).toBeVisible();

    // Start the path → lands on the first course; enroll and finish it.
    await page.goto("/paths");
    await page.getByRole("link", { name: new RegExp(`Zebra Path ${stamp}`) }).click();
    await page.getByRole("button", { name: "Start path" }).click();
    await page.waitForURL(`/courses/${c1.slug}`);
    await page.getByRole("button", { name: "Enroll now" }).click();
    await page.waitForURL(new RegExp(`/learn/${c1.slug}/`));
    await page.getByRole("button", { name: /Mark complete/ }).click();
    await page.waitForURL(/\/done$/);
    await expect(page.getByRole("heading", { name: "Course complete!" })).toBeVisible();

    // Review the course from the done page nudge.
    await page.getByRole("link", { name: /Rate this course/ }).click();
    await page.waitForURL(new RegExp(`/courses/${c1.slug}`));
    await page.getByRole("radio", { name: "5 stars" }).click();
    await page.getByLabel(/What did you think/).fill("Stripes everywhere. Loved it.");
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page.getByText("Thanks — your review is live.")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: "Stripes everywhere. Loved it." })).toBeVisible();
    await expect(page.getByText("5.0 (1)").first()).toBeVisible();

    // Path shows 1/2 done and points at the second course.
    await page.goto("/paths");
    await page.getByRole("link", { name: new RegExp(`Zebra Path ${stamp}`) }).click();
    await expect(page.getByText("1 / 2 courses")).toBeVisible();
    await page.getByRole("button", { name: "Continue path" }).click();
    await page.waitForURL(`/courses/${c2.slug}`);
  } finally {
    await db.learningPath.deleteMany({ where: { title: `Zebra Path ${stamp}` } });
    await db.course.deleteMany({ where: { id: { in: [c1.id, c2.id] } } });
    await db.user.deleteMany({ where: { email: learnerEmail } });
    await db.$disconnect();
  }
});
