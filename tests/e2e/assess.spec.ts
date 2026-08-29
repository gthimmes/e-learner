import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * v1.2 Assess II: a timed quiz with an essay → learner starts it (countdown visible), submits,
 * sees "Awaiting grading" → instructor grades from the queue → attempt passes and the lesson
 * completes.
 */
test("timed quiz with essay is graded by the instructor", async ({ page }) => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const instructor = await db.user.findUniqueOrThrow({ where: { email: "instructor@example.com" } });
  const course = await db.course.create({
    data: {
      slug: `assess-${stamp}`,
      title: `Assess Course ${stamp}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      instructorId: instructor.id,
      modules: {
        create: {
          title: "M1",
          position: 0,
          lessons: {
            create: {
              title: "Timed exam",
              type: "QUIZ",
              position: 0,
              passingScore: 50,
              timeLimitMin: 5,
              questions: {
                create: [
                  { type: "SINGLE", position: 0, points: 1, prompt: "2 + 2 = ?", choices: { create: [{ text: "4", isCorrect: true, position: 0 }, { text: "5", isCorrect: false, position: 1 }] } },
                  { type: "ESSAY", position: 1, points: 2, prompt: "Explain why tests matter.", rubric: "Mentions regressions." },
                ],
              },
            },
          },
        },
      },
    },
    include: { modules: { include: { lessons: true } } },
  });
  const lesson = course.modules[0]!.lessons[0]!;
  const learnerEmail = `assess-${stamp}@example.com`;

  try {
    await page.goto("/register");
    await page.getByLabel("Name").fill("Essa Essayist");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/learn/);

    await page.goto(`/courses/${course.slug}`);
    await page.getByRole("button", { name: "Enroll now" }).click();
    await page.waitForURL(new RegExp(`/learn/${course.slug}/`));

    // Timed quiz needs an explicit start; the countdown appears on the take view.
    await expect(page.getByText("5 minute time limit")).toBeVisible();
    await page.getByRole("button", { name: "Start quiz" }).click();
    await page.waitForURL(/take=/);
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByRole("timer")).toContainText(/4:5\d/);
    await page.getByLabel("4", { exact: true }).check();
    await page.getByLabel("Answer to question 2").fill("Without tests, regressions ship unnoticed.");
    await page.getByRole("button", { name: "Submit answers" }).click();
    await page.waitForURL(/attempt=/);
    await expect(page.getByText("Awaiting grading").first()).toBeVisible();
    await expect(page.getByText("Provisional score")).toBeVisible();

    const attempt = await db.quizAttempt.findFirstOrThrow({ where: { lessonId: lesson.id } });
    expect(attempt.status).toBe("PENDING");
    expect(attempt.score).toBe(33);
    expect(attempt.deadline).not.toBeNull();
    expect(await db.lessonProgress.count({ where: { lessonId: lesson.id } })).toBe(0);

    // Instructor grades from the queue.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto(`/author/${course.id}`);
    await page.getByRole("link", { name: "Grading (1)" }).click();
    await page.waitForURL(/\/grading$/);
    await expect(page.getByText("Essa Essayist")).toBeVisible();
    await expect(page.getByText("Rubric: Mentions regressions.")).toBeVisible();
    await page.getByLabel("Points").fill("2");
    await page.getByLabel(/Feedback/).fill("Spot on.");
    await page.getByRole("button", { name: "Save grade" }).click();
    await expect(page.getByText("Nothing to grade")).toBeVisible();

    const graded = await db.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { answers: true } });
    expect(graded.status).toBe("GRADED");
    expect(graded.score).toBe(100);
    expect(graded.passed).toBe(true);
    expect(graded.answers.find((a) => a.pointsAwarded !== null)?.feedback).toBe("Spot on.");
    expect(await db.lessonProgress.count({ where: { lessonId: lesson.id } })).toBe(1);
  } finally {
    await db.course.deleteMany({ where: { id: course.id } });
    await db.user.deleteMany({ where: { email: learnerEmail } });
    await db.$disconnect();
  }
});
