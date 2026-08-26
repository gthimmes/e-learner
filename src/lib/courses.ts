import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { isAdmin } from "./auth";

/** Full course outline: modules and lessons in display order. */
export const outlineInclude = {
  instructor: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true, slug: true } },
  coAuthors: { include: { user: { select: { id: true, name: true, email: true } } } },
  _count: { select: { enrollments: true } },
  modules: {
    orderBy: { position: "asc" as const },
    include: { lessons: { orderBy: { position: "asc" as const } } },
  },
};

export type CourseOutline = NonNullable<Awaited<ReturnType<typeof getCourseBySlug>>>;
export type OutlineLesson = CourseOutline["modules"][number]["lessons"][number];

/** Minimal shape needed for access decisions. */
export type AccessCourse = { instructorId: string; organizationId: string | null; coAuthors?: Array<{ userId: string }> };
export const accessSelect = { id: true, slug: true, instructorId: true, organizationId: true, coAuthors: { select: { userId: true } } };

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

// ---------- Access rules (NFR-4, AUTHOR-12, ADMIN-6) ----------

/** Edit rights: platform admin, the instructor, a co-author, or an admin of the course's organization. */
export function canEditCourse(user: SessionUser, course: AccessCourse) {
  if (isAdmin(user)) return true;
  if (course.instructorId === user.id) return true;
  if (course.coAuthors?.some((a) => a.userId === user.id)) return true;
  if (user.orgAdmin && course.organizationId && course.organizationId === user.organizationId) return true;
  return false;
}

/** Catalog visibility: public courses (no org) for everyone; org courses only for members. */
export function canViewCourse(user: SessionUser | null, course: AccessCourse & { status: string }) {
  if (user && canEditCourse(user, course)) return true;
  if (course.status !== "PUBLISHED") return false;
  if (!course.organizationId) return true;
  return !!user && user.organizationId === course.organizationId;
}

/** Prisma filter matching what a user may see in the catalog. */
export function visibleCoursesWhere(user: SessionUser | null): Prisma.CourseWhereInput {
  const orgs: Prisma.CourseWhereInput[] = [{ organizationId: null }];
  if (user?.organizationId) orgs.push({ organizationId: user.organizationId });
  return { status: "PUBLISHED", OR: orgs };
}

export async function getPublishedCourses(user: SessionUser | null) {
  const courses = await db.course.findMany({
    where: visibleCoursesWhere(user),
    orderBy: { publishedAt: "desc" },
    include: outlineInclude,
  });
  return courses.map((c) => ({ ...c, stats: courseStats(c) }));
}

export async function getAuthorCourses(user: SessionUser) {
  const mine: Prisma.CourseWhereInput[] = [{ instructorId: user.id }, { coAuthors: { some: { userId: user.id } } }];
  if (user.orgAdmin && user.organizationId) mine.push({ organizationId: user.organizationId });
  const courses = await db.course.findMany({
    where: isAdmin(user) ? {} : { OR: mine },
    orderBy: { updatedAt: "desc" },
    include: {
      instructor: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
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

/** Loads a course the user may edit, or null. */
export async function getCourseForAuthor(courseId: string, user: SessionUser) {
  const course = await getCourseById(courseId);
  if (!course || !canEditCourse(user, course)) return null;
  return course;
}

/** Throws unless the user can edit the course. Used by server actions. */
export async function assertCourseAccess(courseId: string, user: SessionUser) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: accessSelect });
  if (!course || !canEditCourse(user, course)) throw new Error("Course not found or access denied.");
  return course;
}

export async function assertModuleAccess(moduleId: string, user: SessionUser) {
  const mod = await db.module.findUnique({ where: { id: moduleId }, include: { course: { select: accessSelect } } });
  if (!mod || !canEditCourse(user, mod.course)) throw new Error("Module not found or access denied.");
  return mod;
}

export async function assertLessonAccess(lessonId: string, user: SessionUser) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { select: accessSelect } } } },
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
