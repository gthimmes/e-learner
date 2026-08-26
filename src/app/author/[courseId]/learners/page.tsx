import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor } from "@/lib/courses";
import { getCourseLearners } from "@/lib/learning";
import { Badge, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title={`Learners · ${course.title}`}
        subtitle={`${learners.length} enrolled · ${completed} completed`}
        actions={<LinkButton href={`/author/${course.id}`} variant="secondary">← Back to editor</LinkButton>}
      />
      {learners.length === 0 ? (
        <EmptyState title="No learners yet" body={course.status === "PUBLISHED" ? "Share the course link to get enrollments." : "Publish the course to open enrollment."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3 w-64">Progress</th>
                <th className="px-4 py-3">Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
