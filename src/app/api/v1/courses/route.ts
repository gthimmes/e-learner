import { handle, json, requireApiUser } from "@/lib/api";
import { canAuthor } from "@/lib/auth";
import { courseStats, getAuthorCourses, getPublishedCourses } from "@/lib/courses";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const mine = new URL(req.url).searchParams.get("mine") === "1" || new URL(req.url).searchParams.get("mine") === "true";
  const courses = mine && canAuthor(user) ? await getAuthorCourses(user) : await getPublishedCourses(user);
  return json({
    courses: courses.map((c) => {
      const stats = "stats" in c ? c.stats : courseStats(c);
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        status: c.status,
        organizationId: c.organizationId,
        instructor: c.instructor,
        lessonCount: stats.lessonCount,
        durationMin: stats.durationMin,
        enrollmentCount: "enrollmentCount" in c ? c.enrollmentCount : c._count.enrollments,
        publishedAt: c.publishedAt,
        updatedAt: c.updatedAt,
      };
    }),
  });
});
