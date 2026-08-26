import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { isAdmin } from "./auth";

/** Full course outline: modules and lessons in display order. */
export const outlineInclude = {
  instructor: { select: { id: true, name: true } },
  _count: { select: { enrollments: true } },
  modules: {
    orderBy: { position: "asc" as const },
    include: { lessons: { orderBy: { position: "asc" as const } } },
  },
};

export type CourseOutline = NonNullable<Awaited<ReturnType<typeof getCourseBySlug>>>;
export type OutlineLesson = CourseOutline["modules"][number]["lessons"][number];

export async function getCourseBySlug(slug: string) {
  return db.course.findUnique({ where: { slug }, include: outlineInclude });
}

export async function getCourseById(id: string) {
  return db.course.findUnique({ where: { id }, include: outlineInclude });
}

/** Lessons of a course flattened into navigation order. */
export function flattenLessons(course: { modules: Array<{ id: string; title: string; lessons: OutlineLesson[] }> }) {
  return course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
}

export function courseStats(course: { modules: Array<{ lessons: Array<{ durationMin: number }> }> }) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  return {
    moduleCount: course.modules.length,
    lessonCount: lessons.length,
    durationMin: lessons.reduce((sum, l) => sum + l.durationMin, 0),
  };
}

export async function getPublishedCourses() {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      ...outlineInclude,
      _count: { select: { enrollments: true } },
    },
  });
  return courses.map((c) => ({ ...c, stats: courseStats(c) }));
}

export async function getAuthorCourses(user: SessionUser) {
  const courses = await db.course.findMany({
    where: isAdmin(user) ? {} : { instructorId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      instructor: { select: { id: true, name: true } },
      modules: { include: { lessons: { select: { durationMin: true } } } },
      enrollments: { select: { completedAt: true } },
    },
  });
  return courses.map((c) => ({
    ...c,
    stats: courseStats(c),
    enrollmentCount: c.enrollments.length,
    completedCount: c.enrollments.filter((e) => e.completedAt).length,
  }));
}

export function canEditCourse(user: SessionUser, course: { instructorId: string }) {
  return isAdmin(user) || course.instructorId === user.id;
}

/** Loads a course the user may edit, or null. */
export async function getCourseForAuthor(courseId: string, user: SessionUser) {
  const course = await getCourseById(courseId);
  if (!course || !canEditCourse(user, course)) return null;
  return course;
}

/** Throws unless the user can edit the course. Used by server actions. */
export async function assertCourseAccess(courseId: string, user: SessionUser) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, instructorId: true, slug: true } });
  if (!course || !canEditCourse(user, course)) throw new Error("Course not found or access denied.");
  return course;
}

export async function assertModuleAccess(moduleId: string, user: SessionUser) {
  const mod = await db.module.findUnique({ where: { id: moduleId }, include: { course: { select: { id: true, instructorId: true } } } });
  if (!mod || !canEditCourse(user, mod.course)) throw new Error("Module not found or access denied.");
  return mod;
}

export async function assertLessonAccess(lessonId: string, user: SessionUser) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: { id: true, instructorId: true } } } } },
  });
  if (!lesson || !canEditCourse(user, lesson.module.course)) throw new Error("Lesson not found or access denied.");
  return lesson;
}

export async function getLessonForAuthor(lessonId: string, user: SessionUser) {
  try {
    const lesson = await assertLessonAccess(lessonId, user);
    const questions = await db.question.findMany({
      where: { lessonId },
      orderBy: { position: "asc" },
      include: { choices: { orderBy: { position: "asc" } } },
    });
    return { ...lesson, questions };
  } catch {
    return null;
  }
}

export async function isSlugTaken(slug: string, exceptCourseId?: string) {
  const existing = await db.course.findUnique({ where: { slug }, select: { id: true } });
  return !!existing && existing.id !== exceptCourseId;
}
