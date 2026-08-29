import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * v2.2 Live: instructor schedules a session (invite → notification) and opens office hours;
 * learner RSVPs, downloads the .ics, books a slot; instructor attaches a recording to a lesson
 * and the learner sees it there.
 */
test("live session, calendar invite, office hours, recording", async ({ page }) => {
  const db = new PrismaClient();
  const stamp = Date.now();
  const instructor = await db.user.findUniqueOrThrow({ where: { email: "instructor@example.com" } });
  const course = await db.course.create({
    data: {
      slug: `live-${stamp}`,
      title: `Live Course ${stamp}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      instructorId: instructor.id,
      modules: { create: { title: "M1", position: 0, lessons: { create: { title: "Intro", type: "TEXT", position: 0, body: "hello there, this lesson has enough text" } } } },
    },
    include: { modules: { include: { lessons: true } } },
  });
  const lesson = course.modules[0]!.lessons[0]!;
  const learnerEmail = `live-${stamp}@example.com`;
  const learner = await db.user.create({ data: { email: learnerEmail, name: "Liv Learner", passwordHash: "x" } });
  await db.enrollment.create({ data: { userId: learner.id, courseId: course.id } });
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);

    // Schedule a session tomorrow + office hours.
    await page.goto(`/author/${course.id}/live`);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await page.getByLabel("Title").fill("Kickoff Q&A");
    await page.getByLabel("Starts", { exact: true }).fill(local(tomorrow));
    await page.getByLabel("Join URL").fill("https://meet.example.com/kickoff");
    await page.getByRole("button", { name: "Schedule session" }).click();
    await expect(page.getByText("Kickoff Q&A")).toBeVisible();
    await page.getByLabel("First slot starts").fill(local(new Date(Date.now() + 2 * 86_400_000)));
    await page.getByLabel("Number of slots").fill("2");
    await page.getByRole("button", { name: "Create slots" }).click();
    await expect(page.getByText("Open").first()).toBeVisible();
    const session = await db.liveSession.findFirstOrThrow({ where: { courseId: course.id } });
    expect(await db.notification.count({ where: { userId: learner.id, type: "live" } })).toBe(1);

    // Learner: RSVP, download invite, book office hours.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await db.user.update({ where: { id: learner.id }, data: { passwordHash: (await db.user.findUniqueOrThrow({ where: { email: "learner@example.com" } })).passwordHash } });
    await page.goto("/login");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await expect(page.getByText("Kickoff Q&A")).toBeVisible(); // upcoming strip on My Learning

    await page.goto(`/courses/${course.slug}`);
    await expect(page.getByRole("heading", { name: "Live sessions" })).toBeVisible();
    await page.getByRole("button", { name: "Going" }).click();
    await expect(page.getByRole("button", { name: "Going", pressed: true })).toBeVisible();
    await expect(page.getByText("1 going")).toBeVisible();

    const ics = await page.request.get(`/api/live/${session.id}.ics`); // shares the signed-in session
    expect(ics.status()).toBe(200);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    const body = await ics.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("Kickoff Q&A");
    expect(body).toContain("https://meet.example.com/kickoff");

    await page.getByLabel("Topic").first().fill("Assessment design");
    await page.getByRole("button", { name: "Book" }).first().click();
    await expect(page.getByText(/Your slot:/)).toBeVisible();
    expect(await db.officeHourSlot.count({ where: { courseId: course.id, bookedById: learner.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: instructor.id, type: "live" } })).toBeGreaterThan(0);

    // Instructor attaches a recording to the lesson (session moved to the past).
    await db.liveSession.update({ where: { id: session.id }, data: { startsAt: new Date(Date.now() - 2 * 3_600_000), endsAt: new Date(Date.now() - 3_600_000) } });
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login");
    await page.getByLabel("Email").fill("instructor@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto(`/author/${course.id}/live`);
    await page.getByLabel("Recording URL").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await page.getByLabel("Show on lesson").selectOption(lesson.id);
    await page.getByRole("button", { name: "Attach recording" }).click();
    await expect(page.getByText(/recording attached to “Intro”/)).toBeVisible();

    // Learner sees the recording on the lesson.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    await page.goto("/login");
    await page.getByLabel("Email").fill(learnerEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/learn/);
    await page.goto(`/learn/${course.slug}/${lesson.id}`);
    await expect(page.getByText(/Session recording/)).toBeVisible();
    await expect(page.locator('iframe[src*="youtube"]')).toBeVisible();
  } finally {
    await db.course.deleteMany({ where: { id: course.id } });
    await db.user.deleteMany({ where: { email: learnerEmail } });
    await db.notification.deleteMany({ where: { userId: instructor.id, type: "live" } });
    await db.$disconnect();
  }
});
