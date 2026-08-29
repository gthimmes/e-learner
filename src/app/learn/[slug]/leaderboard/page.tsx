import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditCourse, getCourseBySlug } from "@/lib/courses";
import { db } from "@/lib/db";
import { getLeaderboard } from "@/lib/engage";
import { Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Leaderboard" };

/** Cohort (or course-wide) ranking by points (LEARN-20). */
export default async function LeaderboardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cohort?: string }> }) {
  const [{ slug }, { cohort: cohortParam }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/learn/${slug}/leaderboard`);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const isAuthor = canEditCourse(user, course);
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } }, include: { cohort: true } });
  if (!enrollment && !isAuthor) notFound();

  // Learners see their own cohort; authors may pick any cohort via ?cohort=.
  const cohort = isAuthor && cohortParam ? await db.cohort.findFirst({ where: { id: cohortParam, courseId: course.id } }) : (enrollment?.cohort ?? null);
  const rows = await getLeaderboard(course.id, cohort?.id ?? null);
  const cohorts = isAuthor ? await db.cohort.findMany({ where: { courseId: course.id }, orderBy: { startsAt: "desc" } }) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 text-sm text-zinc-500">
        <Link href={`/courses/${slug}`} className="hover:underline">
          {course.title}
        </Link>{" "}
        / Leaderboard
      </div>
      <PageHeader title="🏆 Leaderboard" subtitle={cohort ? `${cohort.name} cohort · points from lessons, quizzes and completion` : "Everyone in this course · points from lessons, quizzes and completion"} />

      {isAuthor && cohorts.length ? (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link href={`/learn/${slug}/leaderboard`} className={!cohort ? "rounded-full bg-indigo-600 px-3 py-1 text-white" : "rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700"}>
            Whole course
          </Link>
          {cohorts.map((c) => (
            <Link key={c.id} href={`/learn/${slug}/leaderboard?cohort=${c.id}`} className={cohort?.id === c.id ? "rounded-full bg-indigo-600 px-3 py-1 text-white" : "rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700"}>
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Learner</th>
              <th className="px-4 py-3">Points</th>
              <th className="px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.userId} className={r.userId === user.id ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}>
                <td className="px-4 py-3 font-semibold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
                <td className="px-4 py-3">
                  {r.name}
                  {r.userId === user.id ? <span className="ml-2 text-xs text-indigo-600">(you)</span> : null}
                  {r.completedAt ? (
                    <span className="ml-2">
                      <Badge tone="success">Completed {formatDate(r.completedAt)}</Badge>
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-medium">{r.points}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={r.progressPct} className="w-24" />
                    <span className="text-xs text-zinc-500">{r.progressPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No learners yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
