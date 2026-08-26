import "server-only";
import { db } from "./db";
import { flattenLessons, getCourseBySlug, courseStats, type CourseOutline } from "./courses";
import { pct } from "./utils";

export async function getEnrollment(userId: string, courseId: string) {
  return db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { progress: { select: { lessonId: true, completedAt: true } } },
  });
}

export type LearnerContext = {
  course: CourseOutline;
  lessons: ReturnType<typeof flattenLessons>;
  enrollment: NonNullable<Awaited<ReturnType<typeof getEnrollment>>> | null;
  completed: Set<string>;
  progressPct: number;
};

/** Everything the player needs for a learner + course slug. Course may be unpublished only for previewing authors. */
export async function getLearnerContext(userId: string | null, slug: string): Promise<LearnerContext | null> {
  const course = await getCourseBySlug(slug);
  if (!course) return null;
  const lessons = flattenLessons(course);
  const enrollment = userId ? await getEnrollment(userId, course.id) : null;
  const completed = new Set(enrollment?.progress.map((p) => p.lessonId) ?? []);
  const done = lessons.filter((l) => completed.has(l.id)).length;
  return { course, lessons, enrollment, completed, progressPct: pct(done, lessons.length) };
}

/**
 * Phase 2 hook: sequential courses lock a lesson until every earlier lesson is complete.
 * Phase 1 courses are free navigation (sequential = false).
 */
export function isLessonUnlocked(ctx: LearnerContext, lessonId: string) {
  if (!ctx.course.sequential) return true;
  for (const l of ctx.lessons) {
    if (l.id === lessonId) return true;
    if (!ctx.completed.has(l.id)) return false;
  }
  return true;
}

/** The lesson to resume: last visited, else first incomplete, else first. */
export function resumeLessonId(ctx: LearnerContext) {
  const last = ctx.enrollment?.lastLessonId;
  if (last && ctx.lessons.some((l) => l.id === last)) return last;
  const firstIncomplete = ctx.lessons.find((l) => !ctx.completed.has(l.id));
  return firstIncomplete?.id ?? ctx.lessons[0]?.id ?? null;
}

export async function getMyEnrollments(userId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: {
        include: {
          instructor: { select: { name: true } },
          modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, select: { id: true, durationMin: true } } } },
        },
      },
      progress: { select: { lessonId: true } },
    },
  });
  return enrollments.map((e) => {
    const stats = courseStats(e.course);
    const done = e.progress.length;
    return { ...e, stats, done, progressPct: pct(done, stats.lessonCount) };
  });
}

/** Instructor view: every learner in a course with progress %. */
export async function getCourseLearners(courseId: string) {
  const [enrollments, lessonCount] = await Promise.all([
    db.enrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { progress: true } } },
    }),
    db.lesson.count({ where: { module: { courseId } } }),
  ]);
  return enrollments.map((e) => ({ ...e, lessonCount, progressPct: pct(e._count.progress, lessonCount) }));
}
