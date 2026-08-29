import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";

/**
 * v2.1: automated WCAG 2.2 AA audit (axe-core) over the main learner and author surfaces.
 * Fails on any violation of the A/AA rule sets.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).exclude("iframe").analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${name} has accessibility violations:\n${summary.join("\n")}`).toEqual([]);
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/learn/);
}

test("public and learner pages pass WCAG 2.2 AA", async ({ page }) => {
  const db = new PrismaClient();
  const course = await db.course.findUniqueOrThrow({ where: { slug: "intro-to-online-teaching" }, include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } } });
  await db.$disconnect();
  const lesson = course.modules[0]!.lessons[0]!;

  await page.goto("/");
  await audit(page, "catalog");
  await page.goto("/login");
  await audit(page, "login");
  await page.goto("/register");
  await audit(page, "register");
  await page.goto(`/courses/${course.slug}`);
  await audit(page, "course landing");
  await page.goto("/paths/online-instructor");
  await audit(page, "learning path");

  await login(page, "learner@example.com");
  await page.goto("/learn");
  await audit(page, "my learning");
  await page.goto(`/learn/${course.slug}/${lesson.id}`);
  await audit(page, "lesson player");
  await page.goto("/me");
  await audit(page, "profile");
  await page.goto("/notifications");
  await audit(page, "notifications");
});

test("author pages pass WCAG 2.2 AA", async ({ page }) => {
  const db = new PrismaClient();
  const course = await db.course.findUniqueOrThrow({ where: { slug: "intro-to-online-teaching" }, include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } } });
  await db.$disconnect();
  const quiz = course.modules[2]!.lessons[1]!;

  await login(page, "instructor@example.com");
  await page.goto("/author");
  await audit(page, "author dashboard");
  await page.goto(`/author/${course.id}`);
  await audit(page, "course editor");
  await page.goto(`/author/${course.id}/lessons/${quiz.id}`);
  await audit(page, "quiz editor");
  await page.goto(`/author/${course.id}/learners`);
  await audit(page, "learners");
  await page.goto("/author/new");
  await audit(page, "new course");
  await page.goto("/settings");
  await audit(page, "integrations");
});
