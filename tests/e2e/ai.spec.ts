import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * v2.0 Copilot (mock provider in CI): instructor drafts a whole course from a prompt, generates
 * quiz questions, drafts a lesson body; a learner asks the grounded tutor.
 */
test("draft a course with AI, generate questions, ask the tutor", async ({ page }) => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const topic = `Zebra husbandry ${stamp}`;
  const learnerEmail = `ai-${stamp}@example.com`;
  let courseId = "";

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);

    await page.goto("/author/new");
    await page.getByLabel("What should the course teach?").fill(topic);
    await page.getByLabel("Audience").fill("zookeepers");
    await page.getByLabel("Modules").selectOption("2");
    await page.getByLabel("Lessons / module").selectOption("3");
    await page.getByRole("button", { name: /Draft course/ }).click();
    await page.waitForURL(/\/author\/[a-z0-9]+\?ai=1$/);
    courseId = page.url().match(/\/author\/([a-z0-9]+)/)![1]!;
    await expect(page.getByText(/Drafted by the copilot/)).toBeVisible();
    const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, include: { modules: { include: { lessons: { include: { questions: true } } } } } });
    expect(course.status).toBe("DRAFT");
    expect(course.modules).toHaveLength(2);
    expect(course.modules[0]!.lessons).toHaveLength(3);
    const quiz = course.modules[0]!.lessons.find((l) => l.type === "QUIZ")!;
    expect(quiz.questions.length).toBeGreaterThan(0);

    // Generate more questions for the quiz lesson from the course text.
    await page.goto(`/author/${courseId}/lessons/${quiz.id}`);
    const before = quiz.questions.length;
    await page.getByLabel("How many").fill("3");
    await page.getByRole("button", { name: /Generate questions/ }).click();
    await expect(page.locator("form[id^=q-]")).toHaveCount(before + 3);

    // Draft a lesson body into the editor.
    const text = course.modules[0]!.lessons.find((l) => l.type === "TEXT")!;
    await page.goto(`/author/${courseId}/lessons/${text.id}`);
    await page.getByLabel(/Content/).fill("");
    await page.getByRole("button", { name: /Draft with AI/ }).click();
    await expect(page.getByLabel(/Content/)).toHaveValue(/Key points/);

    // Publish and let a learner ask the tutor.
    await page.goto(`/author/${courseId}`);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");

    await page.goto("/register");
    await page.getByLabel("Name").fill("Ada Asker");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto(`/courses/${course.slug}`);
    await page.getByRole("button", { name: "Enroll now" }).click();
    await page.waitForURL(new RegExp(`/learn/${course.slug}/`));
    await page.getByRole("button", { name: /Ask the tutor/ }).click();
    await page.getByLabel("Your question").fill("Why does starting with the why matter?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText(/Tutor/).last()).toBeVisible();
    await expect(page.getByText(/Good question|does not cover/)).toBeVisible();
  } finally {
    if (courseId) await db.course.deleteMany({ where: { id: courseId } });
    await db.user.deleteMany({ where: { email: learnerEmail } });
    await db.$disconnect();
  }
});
