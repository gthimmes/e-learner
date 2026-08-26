import { getCurrentUser, canAuthor } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessSelect, canEditCourse } from "@/lib/courses";
import { getCourseLearners } from "@/lib/learning";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET → CSV of every learner's progress and best quiz scores (ADMIN-5). */
export async function GET(_req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const user = await getCurrentUser();
  if (!canAuthor(user)) return new Response("Forbidden", { status: 403 });
  const course = await db.course.findUnique({ where: { id: courseId }, select: accessSelect });
  if (!course || !user || !canEditCourse(user, course)) return new Response("Not found", { status: 404 });

  const [learners, quizzes] = await Promise.all([
    getCourseLearners(courseId),
    db.lesson.findMany({ where: { type: "QUIZ", module: { courseId } }, select: { id: true, title: true }, orderBy: [{ module: { position: "asc" } }, { position: "asc" }] }),
  ]);
  const attempts = await db.quizAttempt.findMany({
    where: { lessonId: { in: quizzes.map((q) => q.id) } },
    select: { enrollmentId: true, lessonId: true, score: true },
  });
  const best = new Map<string, number>();
  for (const a of attempts) {
    const k = `${a.enrollmentId}:${a.lessonId}`;
    best.set(k, Math.max(best.get(k) ?? 0, a.score));
  }

  const header = ["name", "email", "enrolled_at", "lessons_completed", "lessons_total", "progress_pct", "completed_at", ...quizzes.map((q) => `quiz: ${q.title} (best %)`)];
  const rows = learners.map((l) => [
    l.user.name,
    l.user.email,
    l.enrolledAt.toISOString(),
    l._count.progress,
    l.lessonCount,
    l.progressPct,
    l.completedAt?.toISOString() ?? "",
    ...quizzes.map((q) => best.get(`${l.id}:${q.id}`) ?? ""),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${course.slug}-learners.csv"`,
    },
  });
}
