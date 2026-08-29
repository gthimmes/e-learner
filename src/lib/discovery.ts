import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { isAdmin } from "./auth";
import { canViewCourse, courseStats, outlineInclude, visibleCoursesWhere } from "./courses";
import { CATALOG_SORTS, COURSE_LEVELS, type CatalogSort } from "./constants";
import { pct } from "./utils";

// ---------- Tags ----------

export function splitTags(csv: string | null | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------- Ratings ----------

export type RatingSummary = { avg: number; count: number };

/** Average rating + count per course id (courses without reviews are absent). */
export async function ratingsFor(courseIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (courseIds.length === 0) return out;
  const rows = await db.review.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) out.set(r.courseId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all });
  return out;
}

export async function getCourseReviews(courseId: string) {
  return db.review.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

export async function getMyReview(userId: string, courseId: string) {
  return db.review.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

// ---------- Catalog search (LEARN-14) ----------

export type CatalogQuery = { q?: string; tag?: string; level?: string; sort?: string };

export function normalizeCatalogQuery(raw: CatalogQuery) {
  const q = (raw.q ?? "").trim().slice(0, 100);
  const tag = (raw.tag ?? "").trim().toLowerCase().slice(0, 30);
  const level = COURSE_LEVELS.includes(raw.level as (typeof COURSE_LEVELS)[number]) && raw.level !== "ALL" ? (raw.level as string) : "";
  const sort: CatalogSort = CATALOG_SORTS.includes(raw.sort as CatalogSort) ? (raw.sort as CatalogSort) : "newest";
  return { q, tag, level, sort };
}

export async function searchCourses(user: SessionUser | null, raw: CatalogQuery) {
  const { q, tag, level, sort } = normalizeCatalogQuery(raw);
  const and: Prisma.CourseWhereInput[] = [visibleCoursesWhere(user)];
  if (q) and.push({ OR: [{ title: { contains: q } }, { summary: { contains: q } }, { description: { contains: q } }, { tags: { contains: q } }] });
  if (tag) and.push({ tags: { contains: tag } });
  if (level) and.push({ level });

  const courses = await db.course.findMany({ where: { AND: and }, include: outlineInclude, orderBy: { publishedAt: "desc" } });
  const ratings = await ratingsFor(courses.map((c) => c.id));
  let list = courses
    .filter((c) => !tag || splitTags(c.tags).includes(tag)) // `contains` is a substring match; require an exact tag
    .map((c) => ({ ...c, stats: courseStats(c), tagList: splitTags(c.tags), rating: ratings.get(c.id) ?? { avg: 0, count: 0 } }));

  if (sort === "popular") list = list.sort((a, b) => b._count.enrollments - a._count.enrollments);
  else if (sort === "rating") list = list.sort((a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count);
  else if (sort === "title") list = list.sort((a, b) => a.title.localeCompare(b.title));
  // Featured courses float to the top regardless of sort.
  list = [...list.filter((c) => c.featured), ...list.filter((c) => !c.featured)];
  return { courses: list, query: { q, tag, level, sort } };
}

/** Tag → count over the courses the user can see. */
export async function getCatalogTags(user: SessionUser | null) {
  const rows = await db.course.findMany({ where: visibleCoursesWhere(user), select: { tags: true } });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of splitTags(r.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

// ---------- Learning paths (LEARN-15) ----------

export const pathInclude = {
  items: { orderBy: { position: "asc" as const }, include: { course: { include: outlineInclude } } },
  _count: { select: { enrollments: true } },
};

export type PathWithItems = NonNullable<Awaited<ReturnType<typeof getPathBySlug>>>;
export type AccessPath = { createdById: string; organizationId: string | null };

export function canEditPath(user: SessionUser, path: AccessPath) {
  if (isAdmin(user)) return true;
  if (path.createdById === user.id) return true;
  if (user.orgAdmin && path.organizationId && path.organizationId === user.organizationId) return true;
  return false;
}

export function canViewPath(user: SessionUser | null, path: AccessPath & { status: string }) {
  if (user && canEditPath(user, path)) return true;
  if (path.status !== "PUBLISHED") return false;
  if (!path.organizationId) return true;
  return !!user && user.organizationId === path.organizationId;
}

export function visiblePathsWhere(user: SessionUser | null): Prisma.LearningPathWhereInput {
  const orgs: Prisma.LearningPathWhereInput[] = [{ organizationId: null }];
  if (user?.organizationId) orgs.push({ organizationId: user.organizationId });
  return { status: "PUBLISHED", OR: orgs };
}

export async function getPathBySlug(slug: string) {
  return db.learningPath.findUnique({ where: { slug }, include: pathInclude });
}

export async function getPathById(id: string) {
  return db.learningPath.findUnique({ where: { id }, include: pathInclude });
}

export async function getPublishedPaths(user: SessionUser | null) {
  const paths = await db.learningPath.findMany({ where: visiblePathsWhere(user), orderBy: { updatedAt: "desc" }, include: pathInclude });
  return paths.map((p) => {
    const items = p.items.filter((i) => canViewCourse(user, i.course));
    return { ...p, items, stats: pathStats({ items }) };
  });
}

export async function getAuthorPaths(user: SessionUser) {
  const mine: Prisma.LearningPathWhereInput[] = [{ createdById: user.id }];
  if (user.orgAdmin && user.organizationId) mine.push({ organizationId: user.organizationId });
  const paths = await db.learningPath.findMany({ where: isAdmin(user) ? {} : { OR: mine }, orderBy: { updatedAt: "desc" }, include: pathInclude });
  return paths.map((p) => ({ ...p, stats: pathStats(p) }));
}

export async function getPathForAuthor(id: string, user: SessionUser) {
  const path = await getPathById(id);
  if (!path || !canEditPath(user, path)) return null;
  return path;
}

export async function assertPathAccess(id: string, user: SessionUser) {
  const path = await db.learningPath.findUnique({ where: { id }, select: { id: true, slug: true, createdById: true, organizationId: true } });
  if (!path || !canEditPath(user, path)) throw new Error("Path not found or access denied.");
  return path;
}

export function pathStats(path: { items: Array<{ course: { modules: Array<{ lessons: Array<{ durationMin: number }> }> } }> }) {
  let lessonCount = 0;
  let durationMin = 0;
  for (const it of path.items) {
    const s = courseStats(it.course);
    lessonCount += s.lessonCount;
    durationMin += s.durationMin;
  }
  return { courseCount: path.items.length, lessonCount, durationMin };
}

/** Per-course progress for a learner on a path; marks the path enrollment complete when every course is done. */
export async function getPathProgress(userId: string | null, path: PathWithItems) {
  const courseIds = path.items.map((i) => i.courseId);
  const [enrollments, pathEnrollment] = userId
    ? await Promise.all([
        db.enrollment.findMany({ where: { userId, courseId: { in: courseIds } }, include: { _count: { select: { progress: true } } } }),
        db.pathEnrollment.findUnique({ where: { pathId_userId: { pathId: path.id, userId } } }),
      ])
    : [[], null];
  const byCourse = new Map(enrollments.map((e) => [e.courseId, e]));
  const courses = path.items.map((it) => {
    const e = byCourse.get(it.courseId);
    const lessonCount = courseStats(it.course).lessonCount;
    return {
      item: it,
      enrolled: !!e,
      completed: !!e?.completedAt,
      progressPct: e ? pct(e._count.progress, lessonCount) : 0,
    };
  });
  const completedCount = courses.filter((c) => c.completed).length;
  const allDone = courses.length > 0 && completedCount === courses.length;
  if (allDone && pathEnrollment && !pathEnrollment.completedAt) {
    await db.pathEnrollment.update({ where: { id: pathEnrollment.id }, data: { completedAt: new Date() } });
  }
  /** The next course to work on: first not-completed course in order. */
  const next = courses.find((c) => !c.completed)?.item.course ?? null;
  return { courses, completedCount, progressPct: pct(completedCount, courses.length), started: !!pathEnrollment, completed: allDone, next };
}

export async function getMyPaths(userId: string) {
  const rows = await db.pathEnrollment.findMany({ where: { userId }, include: { path: { include: pathInclude } }, orderBy: { startedAt: "desc" } });
  return Promise.all(rows.map(async (r) => ({ ...r, progress: await getPathProgress(userId, r.path) })));
}
