import { getCurrentUser, canAuthor } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessSelect, canEditCourse } from "@/lib/courses";
import { buildScormPackage } from "@/lib/scorm";

/** GET → SCORM 1.2 zip of the course (v0.9 interop). */
export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const user = await getCurrentUser();
  if (!canAuthor(user)) return new Response("Forbidden", { status: 403 });
  const course = await db.course.findUnique({ where: { id: courseId }, select: accessSelect });
  if (!course || !user || !canEditCourse(user, course)) return new Response("Not found", { status: 404 });

  const { filename, data } = await buildScormPackage(courseId);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(data.length),
    },
  });
}
