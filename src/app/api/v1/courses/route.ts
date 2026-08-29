import { handle, json, requireApiUser } from "@/lib/api";
import { canAuthor } from "@/lib/auth";
import { courseStats, getAuthorCourses } from "@/lib/courses";
import { ratingsFor, searchCourses, splitTags } from "@/lib/discovery";

/** GET /api/v1/courses?q=&tag=&level=&sort=  (or ?mine=1 for an author's own courses incl. drafts). */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const sp = new URL(req.url).searchParams;
  const mine = sp.get("mine") === "1" || sp.get("mine") === "true";
  if (mine && canAuthor(user)) {
    const courses = await getAuthorCourses(user);
    const ratings = await ratingsFor(courses.map((c) => c.id));
    return json({
      courses: courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        status: c.status,
        organizationId: c.organizationId,
        instructor: c.instructor,
        tags: splitTags(c.tags),
        level: c.level,
        priceCents: c.priceCents,
        currency: c.currency,
        lessonCount: c.stats.lessonCount,
        durationMin: c.stats.durationMin,
        enrollmentCount: c.enrollmentCount,
        rating: ratings.get(c.id) ?? { avg: 0, count: 0 },
        publishedAt: c.publishedAt,
        updatedAt: c.updatedAt,
      })),
    });
  }
  const { courses, query } = await searchCourses(user, {
    q: sp.get("q") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    level: sp.get("level") ?? undefined,
    sort: sp.get("sort") ?? undefined,
  });
  return json({
    query,
    courses: courses.map((c) => {
      const stats = courseStats(c);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        status: c.status,
        organizationId: c.organizationId,
        instructor: c.instructor,
        tags: c.tagList,
        level: c.level,
        priceCents: c.priceCents,
        currency: c.currency,
        lessonCount: stats.lessonCount,
        durationMin: stats.durationMin,
        enrollmentCount: c._count.enrollments,
        rating: c.rating,
        publishedAt: c.publishedAt,
        updatedAt: c.updatedAt,
      };
    }),
  });
});
