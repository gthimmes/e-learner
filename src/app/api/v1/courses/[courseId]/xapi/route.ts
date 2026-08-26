import { ApiError, handle, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { accessSelect, canEditCourse } from "@/lib/courses";
import { buildCourseStatements } from "@/lib/xapi";

/** GET → xAPI statements for every enrollment, completion and quiz attempt in the course. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ courseId: string }> }) => {
  const user = await requireApiUser(req);
  const { courseId } = await ctx.params;
  const course = await db.course.findUnique({ where: { id: courseId }, select: accessSelect });
  if (!course || !canEditCourse(user, course)) throw new ApiError(404, "Course not found.");
  const statements = await buildCourseStatements(courseId);
  return json({ statements, count: statements.length, version: "1.0.3" });
});
