import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditCourse, accessSelect } from "@/lib/courses";
import { sessionIcs } from "@/lib/live";

/** GET /api/live/[sessionId] — calendar invite (.ics) for enrolled learners and course editors (v2.2). */
export async function GET(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const id = sessionId.replace(/\.ics$/, "");
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download the invite.", { status: 401 });
  const s = await db.liveSession.findUnique({ where: { id }, include: { course: { select: { ...accessSelect, title: true, instructor: { select: { name: true, email: true } } } } } });
  if (!s) return new Response("Not found", { status: 404 });
  const enrolled = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: s.courseId } }, select: { cohortId: true } });
  const editor = canEditCourse(user, s.course);
  if (!editor && (!enrolled || (s.cohortId && s.cohortId !== enrolled.cohortId))) return new Response("Not found", { status: 404 });
  const ics = sessionIcs(s, s.course, s.course.instructor);
  return new Response(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${s.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics"` },
  });
}
