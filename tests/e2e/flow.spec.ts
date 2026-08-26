import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end: instructor authors + publishes a course with a quiz; a learner
 * enrolls, completes the lessons, passes the quiz, and gets a certificate.
 * Requires a seeded DB (npm run db:seed) so the instructor account exists.
 */
const stamp = `${Date.now()}`;
const courseTitle = `E2E Course ${stamp}`;
const learnerEmail = `learner-${stamp}@example.com`;

async function login(page: Page, email: string, password = "password123") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/learn/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("/");
}

test("author → publish → enroll → complete → quiz → certificate", async ({ page }) => {
  // ---------- Instructor ----------
  await login(page, "instructor@example.com");

  await page.goto("/author/new");
  await page.getByLabel("Title").fill(courseTitle);
  await page.getByLabel("Summary").fill("Created by the e2e test.");
  await page.getByRole("button", { name: "Create course" }).click();
  await page.waitForURL(/\/author\/(?!new$)[a-z0-9]+$/);
  const courseUrl = page.url();

  // Course starts with "Module 1". Add a reading lesson and a quiz lesson.
  const outline = page.locator("section", { hasText: "Outline" });
  await outline.getByPlaceholder("New lesson title").first().fill("Reading one");
  await outline.getByRole("button", { name: "Add lesson" }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.getByLabel("Content").fill("# Hello\n\nThis is **markdown**.");
  await page.getByRole("button", { name: "Save lesson" }).click();
  await expect(page.getByText("Lesson saved.")).toBeVisible();

  await page.goto(courseUrl);
  await outline.getByPlaceholder("New lesson title").first().fill("Final quiz");
  await outline.getByLabel("Lesson type").first().selectOption("QUIZ");
  await outline.getByRole("button", { name: "Add lesson" }).first().click();
  await page.waitForURL(/\/lessons\//);
  const quizUrl = page.url();

  // Add a single-choice question.
  await page.getByLabel("Question type").selectOption("SINGLE");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.waitForURL(/#q-/);
  const q1 = page.locator("form[id^='q-']").first();
  await q1.getByLabel(/^Question$|^QuestionMarkdown/).fill("What is 2 + 2?");
  const choices = q1.getByPlaceholder("Choice text");
  await choices.nth(0).fill("4");
  await choices.nth(1).fill("3");
  await choices.nth(2).fill("5");
  await q1.getByLabel("Correct").nth(0).check();
  await q1.getByRole("button", { name: "Save question" }).click();
  await expect(page.locator("form[id^='q-']").first().getByLabel(/^Question$|^QuestionMarkdown/)).toHaveValue("What is 2 + 2?");

  // Add a short-answer question.
  await page.getByLabel("Question type").selectOption("SHORT");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.waitForURL(/#q-/);
  const q2 = page.locator("form[id^='q-']").nth(1);
  await q2.getByLabel(/^Question$|^QuestionMarkdown/).fill("Name the markup language used for lessons.");
  await q2.getByLabel(/^Correct answer/).fill("markdown");
  await q2.getByRole("button", { name: "Save question" }).click();
  await expect(page.locator("form[id^='q-']").nth(1).getByLabel(/^Correct answer/)).toHaveValue("markdown");

  // Co-author (AUTHOR-12): add the admin, then remove.
  await page.goto(courseUrl);
  await page.getByLabel("Co-author email").fill("admin@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/can now edit this course/)).toBeVisible();
  await page.getByLabel("Co-author email").fill("learner@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/is a learner/)).toBeVisible();

  // Publish.
  await page.goto(courseUrl);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  const slug = await page.getByRole("link", { name: "View", exact: true }).getAttribute("href");
  expect(slug).toMatch(/^\/courses\//);
  await logout(page);

  // ---------- Learner ----------
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Learner");
  await page.getByLabel("Email").fill(learnerEmail);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/learn/);

  await page.goto("/");
  await expect(page.getByText(courseTitle)).toBeVisible();
  await page.goto(slug!);
  await page.getByRole("button", { name: "Enroll now" }).click();
  await page.waitForURL(/\/learn\/.+\/.+/);

  // Reading lesson → mark complete & continue → lands on quiz.
  await expect(page.getByRole("heading", { name: "Reading one" })).toBeVisible();
  await expect(page.getByText("This is markdown.")).toBeVisible();

  // Discussion: post, reply, delete (LEARN-13).
  await page.getByLabel("Add a comment").fill("Is this on the quiz?");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("Is this on the quiz?")).toBeVisible();
  await page.getByText("Reply", { exact: true }).click();
  await page.getByPlaceholder("Write a reply…").fill("Never mind, found it.");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Never mind, found it.")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).last().click();
  await expect(page.getByText("Comment removed.")).toBeVisible();
  await page.getByRole("button", { name: /Mark complete & continue/ }).click();
  await expect(page.getByRole("heading", { name: "Final quiz" })).toBeVisible();

  // Fail the quiz first (wrong answers).
  await page.getByLabel("3").check();
  await page.getByPlaceholder("Your answer").fill("html");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("article").getByText("0%", { exact: true })).toBeVisible();
  await expect(page.getByText(/Not passed/).first()).toBeVisible();

  // Retry and pass.
  await page.getByRole("link", { name: /Try again/ }).click();
  await page.getByLabel("4").check();
  await page.getByPlaceholder("Your answer").fill("  MarkDown ");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("article").getByText("100%", { exact: true })).toBeVisible();
  await expect(page.getByText("Passed", { exact: true }).first()).toBeVisible();

  // Course is complete → certificate.
  await page.getByRole("link", { name: /Finish/ }).click();
  await expect(page.getByRole("heading", { name: "Course complete!" })).toBeVisible();
  await page.getByRole("link", { name: /View certificate/ }).click();
  await expect(page.getByText("Certificate of completion")).toBeVisible();
  await expect(page.locator("main").getByText("E2E Learner")).toBeVisible();
  await expect(page.locator("main").getByText(courseTitle)).toBeVisible();

  // My Learning shows it completed.
  await page.goto("/learn");
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
  await logout(page);

  // ---------- Instructor sees results ----------
  await login(page, "instructor@example.com");
  await page.goto(quizUrl);
  await expect(page.getByText("Quiz results")).toBeVisible();
  await expect(page.getByText("Pass rate")).toBeVisible();
  await page.goto(courseUrl.replace(/\/author\/([a-z0-9]+)$/, "/author/$1/learners"));
  await expect(page.getByText("E2E Learner")).toBeVisible();
  await expect(page.getByText(/^Completed/).first()).toBeVisible();

  // Cohorts: create one with a past due date and assign the learner (LEARN-12).
  await page.getByLabel("New cohort name").fill("Cohort A");
  await page.locator("#new-due").fill("2020-01-01");
  await page.getByRole("button", { name: "Add cohort" }).click();
  await expect(page.getByLabel("Cohort name").first()).toHaveValue("Cohort A");
  await page.getByLabel("Cohort for E2E Learner").selectOption({ label: "Cohort A" });
  await page.getByRole("button", { name: "Set" }).click();
  await expect(page.getByRole("combobox", { name: "Cohort for E2E Learner" })).toHaveValue(/./);
  // Learner completed the course, so no overdue badge; a fresh learner would be flagged.
});
