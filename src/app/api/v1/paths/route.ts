import { handle, json, requireApiUser } from "@/lib/api";
import { getPublishedPaths } from "@/lib/discovery";

/** GET /api/v1/paths — published learning paths visible to the caller. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const paths = await getPublishedPaths(user);
  return json({
    paths: paths.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      organizationId: p.organizationId,
      courseCount: p.stats.courseCount,
      lessonCount: p.stats.lessonCount,
      durationMin: p.stats.durationMin,
      courses: p.items.map((i) => ({ id: i.courseId, slug: i.course.slug, title: i.course.title, position: i.position })),
      updatedAt: p.updatedAt,
    })),
  });
});
