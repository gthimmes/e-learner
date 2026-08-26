import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor } from "@/lib/courses";
import { getCourseLearners } from "@/lib/learning";
import { removeEnrollment } from "@/lib/actions/roster";
import { EnrollForm } from "@/components/EnrollForm";
import { Badge, Card, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Learners" };

export default async function CourseLearnersPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/learners`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const learners = await getCourseLearners(courseId);
  const completed = learners.filter((l) => l.completedAt).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={`Learners · ${course.title}`}
        subtitle={`${learners.length} enrolled · ${completed} completed`}
        actions={
          <>
            <a
              href={`/author/${course.id}/learners/export`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              ⬇ Export CSV
            </a>
            <LinkButton href={`/author/${course.id}`} variant="secondary">
              ← Back to editor
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          {learners.length === 0 ? (
            <EmptyState title="No learners yet" body={course.status === "PUBLISHED" ? "Share the course link, or enroll learners directly." : "Publish the course to open self-enrollment, or enroll learners directly."} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                  <tr>
                    <th className="px-4 py-3">Learner</th>
                    <th className="px-4 py-3">Enrolled</th>
                    <th className="w-56 px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {learners.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.user.name}</div>
                        <div className="text-xs text-zinc-500">{l.user.email}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(l.enrolledAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProgressBar value={l.progressPct} className="flex-1" />
                          <span className="w-20 text-right text-xs text-zinc-500">
                            {l._count.progress}/{l.lessonCount} · {l.progressPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {l.completedAt ? <Badge tone="success">Completed {formatDate(l.completedAt)}</Badge> : l._count.progress ? <Badge tone="info">In progress</Badge> : <Badge>Not started</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={removeEnrollment}>
                          <input type="hidden" name="enrollmentId" value={l.id} />
                          <button className="text-xs text-zinc-400 hover:text-red-600" title="Remove enrollment and progress">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <Card>
            <EnrollForm courseId={course.id} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
