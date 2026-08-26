import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor } from "@/lib/courses";
import { listVersions } from "@/lib/versions";
import { restoreCourseVersion, saveVersion } from "@/lib/actions/versions";
import { Button, Card, EmptyState, Input, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Versions" };

export default async function CourseVersionsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/versions`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const versions = await listVersions(courseId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title={`Versions · ${course.title}`}
        subtitle="A snapshot is saved every time you publish. Restore any version — learner progress on lessons that still exist is kept (AUTHOR-13)."
        actions={
          <LinkButton href={`/author/${course.id}`} variant="secondary">
            ← Back to editor
          </LinkButton>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          {versions.length === 0 ? (
            <EmptyState title="No versions yet" body="Publish the course or save a snapshot to start the history." />
          ) : (
            <ol className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {versions.map((v, i) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">
                      v{v.number}
                      {i === 0 ? <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">latest</span> : null}
                      {v.note ? <span className="ml-2 font-normal text-zinc-500">— {v.note}</span> : null}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatDate(v.createdAt)} · {v.summary.modules} modules · {v.summary.lessons} lessons · {v.summary.questions} questions
                    </div>
                  </div>
                  <form action={restoreCourseVersion}>
                    <input type="hidden" name="versionId" value={v.id} />
                    <SubmitButton variant="secondary" size="sm" pendingText="Restoring…">
                      Restore
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside>
          <Card>
            <h2 className="text-sm font-semibold">Save a snapshot</h2>
            <form action={saveVersion} className="mt-2 space-y-2">
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="note" placeholder="Note (optional)" maxLength={200} aria-label="Snapshot note" />
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Save snapshot
                </Button>
              </div>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
