import { ApiError, handle, json, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { accessSelect, canEditCourse } from "@/lib/courses";
import { getCourseLearners } from "@/lib/learning";
import { emitEvent } from "@/lib/webhooks";

async function editableCourse(req: Request, courseId: string) {
  const user = await requireApiUser(req);
  const course = await db.course.findUnique({ where: { id: courseId }, select: accessSelect });
  if (!course || !canEditCourse(user, course)) throw new ApiError(404, "Course not found.");
  return { user, course };
}

export const GET = handle(async (req: Request, ctx: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await ctx.params;
  await editableCourse(req, courseId);
  const learners = await getCourseLearners(courseId);
  return json({
    enrollments: learners.map((l) => ({
      id: l.id,
      user: l.user,
      cohort: l.cohort,
      enrolledAt: l.enrolledAt,
      completedAt: l.completedAt,
      lessonsCompleted: l._count.progress,
      lessonsTotal: l.lessonCount,
      progressPct: l.progressPct,
    })),
  });
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ courseId: string }> }) => {
  const { courseId } = await ctx.params;
  await editableCourse(req, courseId);
  const body = (await req.json().catch(() => null)) as { email?: string; cohortId?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email) throw new ApiError(400, "Body must include `email`.");
  const target = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!target) throw new ApiError(404, `No account for ${email}.`);
  if (body?.cohortId) {
    const c = await db.cohort.findUnique({ where: { id: body.cohortId }, select: { courseId: true } });
    if (!c || c.courseId !== courseId) throw new ApiError(404, "Cohort not found for this course.");
  }
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId: target.id, courseId } } });
  if (existing) {
    if (body?.cohortId && existing.cohortId !== body.cohortId) await db.enrollment.update({ where: { id: existing.id }, data: { cohortId: body.cohortId } });
    return json({ enrollment: { id: existing.id, created: false } }, 200);
  }
  const e = await db.enrollment.create({ data: { userId: target.id, courseId, cohortId: body?.cohortId ?? null } });
  void emitEvent("enrollment.created", courseId, target.id);
  return json({ enrollment: { id: e.id, created: true } }, 201);
});
