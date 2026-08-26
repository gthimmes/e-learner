import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourseForAuthor } from "@/lib/courses";
import { getCourseLearners, isOverdue } from "@/lib/learning";
import { removeEnrollment } from "@/lib/actions/roster";
import { createCohort, deleteCohort, setEnrollmentCohort, updateCohort } from "@/lib/actions/cohorts";
import { EnrollForm } from "@/components/EnrollForm";
import { Badge, Button, Card, EmptyState, Input, Label, LinkButton, PageHeader, ProgressBar, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Learners" };

const dateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function CourseLearnersPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/learners`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const [learners, cohorts] = await Promise.all([
    getCourseLearners(courseId),
    db.cohort.findMany({ where: { courseId }, orderBy: { startsAt: "asc" }, include: { _count: { select: { enrollments: true } } } }),
  ]);
  const completed = learners.filter((l) => l.completedAt).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={`Learners · ${course.title}`}
        subtitle={`${learners.length} enrolled · ${completed} completed · ${cohorts.length} cohort${cohorts.length === 1 ? "" : "s"}`}
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

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          {learners.length === 0 ? (
            <EmptyState title="No learners yet" body={course.status === "PUBLISHED" ? "Share the course link, or enroll learners directly." : "Publish the course to open self-enrollment, or enroll learners directly."} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                  <tr>
                    <th className="px-4 py-3">Learner</th>
                    <th className="px-4 py-3">Cohort</th>
                    <th className="w-52 px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {learners.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{l.user.name}</div>
                        <div className="text-xs text-zinc-500">
                          {l.user.email} · enrolled {formatDate(l.enrolledAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <form action={setEnrollmentCohort} className="flex items-center gap-1">
                          <input type="hidden" name="enrollmentId" value={l.id} />
                          <Select name="cohortId" defaultValue={l.cohort?.id ?? ""} aria-label={`Cohort for ${l.user.name}`} className="max-w-40 py-1 text-xs">
                            <option value="">—</option>
                            {cohorts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                          <button className="text-xs text-indigo-600 hover:underline">Set</button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProgressBar value={l.progressPct} className="flex-1" />
                          <span className="w-20 text-right text-xs text-zinc-500">
                            {l._count.progress}/{l.lessonCount} · {l.progressPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {l.completedAt ? (
                          <Badge tone="success">Completed {formatDate(l.completedAt)}</Badge>
                        ) : isOverdue(l.cohort?.dueAt, l.completedAt) ? (
                          <Badge tone="warning">Overdue · due {formatDate(l.cohort?.dueAt)}</Badge>
                        ) : l._count.progress ? (
                          <Badge tone="info">In progress</Badge>
                        ) : (
                          <Badge>Not started</Badge>
                        )}
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

        <aside className="space-y-6">
          <Card>
            <EnrollForm courseId={course.id} cohorts={cohorts} />
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Cohorts</h2>
            <p className="mt-1 text-xs text-zinc-500">Group learners with start, end and due dates. Overdue learners are flagged; reminders go out via <code>scripts/send-reminders.ts</code>.</p>
            <ul className="mt-3 space-y-3">
              {cohorts.map((c) => (
                <li key={c.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <form action={updateCohort} className="space-y-2">
                    <input type="hidden" name="cohortId" value={c.id} />
                    <div className="flex items-center gap-2">
                      <Input name="name" defaultValue={c.name} aria-label="Cohort name" className="py-1 text-sm" />
                      <span className="shrink-0 text-xs text-zinc-500">{c._count.enrollments} 👤</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor={`s-${c.id}`}>Starts</Label>
                        <Input id={`s-${c.id}`} name="startsAt" type="date" defaultValue={dateInput(c.startsAt)} className="px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`d-${c.id}`}>Due</Label>
                        <Input id={`d-${c.id}`} name="dueAt" type="date" defaultValue={dateInput(c.dueAt)} className="px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <Label htmlFor={`e-${c.id}`}>Ends</Label>
                        <Input id={`e-${c.id}`} name="endsAt" type="date" defaultValue={dateInput(c.endsAt)} className="px-2 py-1 text-xs" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button formAction={deleteCohort} className="text-xs text-zinc-400 hover:text-red-600">
                        Delete cohort
                      </button>
                      <Button type="submit" size="sm" variant="secondary">
                        Save
                      </Button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
            <form action={createCohort} className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="name" placeholder="New cohort name (e.g. Fall 2026)" aria-label="New cohort name" required />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="new-starts">Starts</Label>
                  <Input id="new-starts" name="startsAt" type="date" className="px-2 py-1 text-xs" />
                </div>
                <div>
                  <Label htmlFor="new-due">Due</Label>
                  <Input id="new-due" name="dueAt" type="date" className="px-2 py-1 text-xs" />
                </div>
                <div>
                  <Label htmlFor="new-ends">Ends</Label>
                  <Input id="new-ends" name="endsAt" type="date" className="px-2 py-1 text-xs" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add cohort
                </Button>
              </div>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
