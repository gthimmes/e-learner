import "server-only";
import { db } from "./db";
import { appUrl, mailer } from "./mail";
import { computeStreak, dayKey, shiftDay } from "./streak";
import { pct } from "./utils";

// ---------- Catalogue ----------

export const BADGES = {
  FIRST_LESSON: { icon: "🥇", label: "First step", description: "Completed your first lesson" },
  STREAK_7: { icon: "🔥", label: "On fire", description: "Learned seven days in a row" },
  QUIZ_ACE: { icon: "💯", label: "Quiz ace", description: "Scored 100 % on a quiz" },
  FIRST_COURSE: { icon: "🎓", label: "Graduate", description: "Completed your first course" },
  COURSE_COMPLETE: { icon: "🏁", label: "Course complete", description: "Finished a course (one per course)" },
  PATH_COMPLETE: { icon: "🗺️", label: "Pathfinder", description: "Completed a learning path" },
  REVIEWER: { icon: "⭐", label: "Critic", description: "Reviewed a course" },
} as const;
export type BadgeKey = keyof typeof BADGES;

export const POINTS = { LESSON: 10, QUIZ_PASS: 20, QUIZ_ACE_BONUS: 10, COURSE: 50, PATH: 100 } as const;

// ---------- Activity & streaks ----------

export async function recordActivity(userId: string, delta: { lessons?: number; visits?: number } = {}) {
  const day = dayKey();
  await db.activityDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, lessons: delta.lessons ?? 0, visits: delta.visits ?? 0 },
    update: { lessons: { increment: delta.lessons ?? 0 }, visits: { increment: delta.visits ?? 0 } },
  });
}

export async function getStreak(userId: string) {
  const rows = await db.activityDay.findMany({ where: { userId }, select: { day: true } });
  return computeStreak(rows.map((r) => r.day));
}

/** Last `days` days, oldest first, with zero-filled gaps (for the activity strip). */
export async function getActivity(userId: string, days = 14) {
  const today = dayKey();
  const from = shiftDay(today, -(days - 1));
  const rows = await db.activityDay.findMany({ where: { userId, day: { gte: from } } });
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: Array<{ day: string; lessons: number; visits: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDay(today, -i);
    const r = byDay.get(day);
    out.push({ day, lessons: r?.lessons ?? 0, visits: r?.visits ?? 0 });
  }
  return out;
}

// ---------- Points & badges ----------

export async function addPoints(userId: string, enrollmentId: string | null, n: number) {
  await db.user.update({ where: { id: userId }, data: { points: { increment: n } } });
  if (enrollmentId) await db.enrollment.update({ where: { id: enrollmentId }, data: { points: { increment: n } } });
}

/** Awards a badge once; returns true when newly earned (and notifies the learner). */
export async function awardBadge(userId: string, key: BadgeKey, scopeId = "", scopeLabel = "") {
  const existing = await db.badge.findUnique({ where: { userId_key_courseId: { userId, key, courseId: scopeId } } });
  if (existing) return false;
  await db.badge.create({ data: { userId, key, courseId: scopeId } });
  const b = BADGES[key];
  await notify(userId, { type: "badge", title: `${b.icon} Badge earned: ${b.label}`, body: scopeLabel ? `${b.description} — ${scopeLabel}` : b.description, href: "/me" });
  return true;
}

export async function onLessonCompleted(userId: string, enrollmentId: string) {
  await recordActivity(userId, { lessons: 1 });
  await addPoints(userId, enrollmentId, POINTS.LESSON);
  await awardBadge(userId, "FIRST_LESSON");
  const streak = await getStreak(userId);
  if (streak.current >= 7) await awardBadge(userId, "STREAK_7");
}

export async function onCourseCompleted(userId: string, enrollmentId: string, courseId: string) {
  await addPoints(userId, enrollmentId, POINTS.COURSE);
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  await awardBadge(userId, "COURSE_COMPLETE", courseId, course?.title ?? "");
  await awardBadge(userId, "FIRST_COURSE");
}

export async function onQuizPassed(userId: string, enrollmentId: string, score: number) {
  await addPoints(userId, enrollmentId, POINTS.QUIZ_PASS + (score >= 100 ? POINTS.QUIZ_ACE_BONUS : 0));
  if (score >= 100) await awardBadge(userId, "QUIZ_ACE");
}

export async function onPathCompleted(userId: string, pathId: string, pathTitle: string) {
  await addPoints(userId, null, POINTS.PATH);
  await awardBadge(userId, "PATH_COMPLETE", pathId, pathTitle);
}

export async function onReviewed(userId: string) {
  await awardBadge(userId, "REVIEWER");
}

// ---------- Notifications ----------

export type NewNotification = { type: string; title: string; body?: string; href?: string };

export async function notify(userId: string, n: NewNotification) {
  await db.notification.create({ data: { userId, type: n.type, title: n.title, body: n.body ?? "", href: n.href ?? null } });
}

export async function notifyMany(userIds: string[], n: NewNotification) {
  if (userIds.length === 0) return;
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body ?? "", href: n.href ?? null })) });
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function getNotifications(userId: string, limit = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

// ---------- Profile ----------

export async function getEngageSummary(userId: string) {
  const [user, streak, badgeCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { points: true } }),
    getStreak(userId),
    db.badge.count({ where: { userId } }),
  ]);
  return { points: user?.points ?? 0, streak, badgeCount };
}

export async function getProfile(userId: string) {
  const [user, streak, activity, badges, enrollments] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, include: { organization: { select: { name: true } } } }),
    getStreak(userId),
    getActivity(userId, 14),
    db.badge.findMany({ where: { userId }, orderBy: { earnedAt: "desc" } }),
    db.enrollment.findMany({ where: { userId }, select: { completedAt: true } }),
  ]);
  if (!user) return null;
  const scopeIds = badges.map((b) => b.courseId).filter(Boolean);
  const [courses, paths] = await Promise.all([
    db.course.findMany({ where: { id: { in: scopeIds } }, select: { id: true, title: true } }),
    db.learningPath.findMany({ where: { id: { in: scopeIds } }, select: { id: true, title: true } }),
  ]);
  const labels = new Map<string, string>([...courses, ...paths].map((c) => [c.id, c.title]));
  return {
    user,
    streak,
    activity,
    badges: badges.map((b) => ({ ...b, scopeLabel: labels.get(b.courseId) ?? "" })),
    enrolledCount: enrollments.length,
    completedCount: enrollments.filter((e) => e.completedAt).length,
  };
}

// ---------- Leaderboard ----------

/** Ranked learners for a cohort (or the whole course when `cohortId` is null). */
export async function getLeaderboard(courseId: string, cohortId: string | null, limit = 50) {
  const [rows, lessonCount] = await Promise.all([
    db.enrollment.findMany({
      where: cohortId ? { cohortId } : { courseId },
      include: { user: { select: { id: true, name: true } }, _count: { select: { progress: true } } },
      orderBy: [{ points: "desc" }, { completedAt: "asc" }, { enrolledAt: "asc" }],
      take: limit,
    }),
    db.lesson.count({ where: { module: { courseId } } }),
  ]);
  return rows.map((e, i) => ({ rank: i + 1, userId: e.user.id, name: e.user.name, points: e.points, progressPct: pct(e._count.progress, lessonCount), completedAt: e.completedAt }));
}

// ---------- Announcements ----------

export async function getAnnouncements(courseId: string, limit?: number) {
  return db.announcement.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: { name: true } } },
  });
}

/** Posts an announcement, notifies every enrolled learner in-app and optionally by email. */
export async function publishAnnouncement(input: { courseId: string; authorId: string; title: string; body: string; email: boolean }) {
  const course = await db.course.findUnique({ where: { id: input.courseId }, select: { id: true, slug: true, title: true } });
  if (!course) throw new Error("Course not found.");
  const announcement = await db.announcement.create({
    data: { courseId: course.id, authorId: input.authorId, title: input.title, body: input.body, emailed: input.email },
  });
  const learners = await db.enrollment.findMany({ where: { courseId: course.id }, select: { user: { select: { id: true, email: true, name: true } } } });
  const href = `/courses/${course.slug}#announcements`;
  await notifyMany(
    learners.map((l) => l.user.id),
    { type: "announcement", title: `📣 ${course.title}: ${input.title}`, body: input.body.slice(0, 280), href },
  );
  if (input.email) {
    await Promise.all(
      learners.map((l) =>
        mailer
          .send({
            to: l.user.email,
            subject: `[${course.title}] ${input.title}`,
            text: `Hi ${l.user.name},\n\n${input.body}\n\nRead it in the course: ${appUrl(href)}\n\n— e-learner`,
          })
          .catch((e) => console.error("announcement mail failed", e)),
      ),
    );
  }
  return announcement;
}
