import { ApiError, handle, json, requireApiUser } from "@/lib/api";
import { canViewCourse, courseStats, getCourseById } from "@/lib/courses";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ courseId: string }> }) => {
  const user = await requireApiUser(req);
  const { courseId } = await ctx.params;
  const course = await getCourseById(courseId);
  if (!course || !canViewCourse(user, course)) throw new ApiError(404, "Course not found.");
  const stats = courseStats(course);
  return json({
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description,
    coverUrl: course.coverUrl,
    status: course.status,
    sequential: course.sequential,
    organizationId: course.organizationId,
    instructor: course.instructor,
    coAuthors: course.coAuthors.map((a) => a.user),
    enrollmentCount: course._count.enrollments,
    ...stats,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, durationMin: l.durationMin, mediaUrl: l.mediaUrl })),
    })),
    publishedAt: course.publishedAt,
    updatedAt: course.updatedAt,
  });
});
