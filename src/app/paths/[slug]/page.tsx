import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canEditPath, canViewPath, getPathBySlug, getPathProgress, pathStats } from "@/lib/discovery";
import { canViewCourse, courseStats } from "@/lib/courses";
import { startPath } from "@/lib/actions/paths";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, LinkButton, ProgressBar, StatusBadge } from "@/components/ui";
import { formatDuration } from "@/lib/utils";

export default async function PathPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [path, user] = await Promise.all([getPathBySlug(slug), getCurrentUser()]);
  if (!path || !canViewPath(user, path)) notFound();
  const isEditor = !!user && canEditPath(user, path);
  const visible = { ...path, items: path.items.filter((i) => canViewCourse(user, i.course)) };
  const stats = pathStats(visible);
  const progress = await getPathProgress(user?.id ?? null, visible);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone="success">Learning path</Badge>
            {path.status !== "PUBLISHED" ? <StatusBadge status={path.status} /> : null}
            {path.organizationId ? <Badge tone="info">🔒 Organization</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{path.title}</h1>
          {path.summary ? <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-300">{path.summary}</p> : null}
          <p className="mt-2 text-sm text-zinc-500">
            {stats.courseCount} course{stats.courseCount === 1 ? "" : "s"} · {stats.lessonCount} lessons · {formatDuration(stats.durationMin)}
          </p>
          {path.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={path.coverUrl} alt="" className="mt-6 aspect-[21/9] w-full rounded-xl object-cover" />
          ) : null}
          {path.description ? (
            <div className="mt-8">
              <Markdown>{path.description}</Markdown>
            </div>
          ) : null}

          <h2 className="mt-10 text-xl font-semibold">Courses in this path</h2>
          <ol className="mt-4 space-y-3">
            {progress.courses.map((c, i) => {
              const cs = courseStats(c.item.course);
              return (
                <li key={c.item.id} className="flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <span
                    className={
                      c.completed
                        ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-sm font-semibold text-white"
                        : "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }
                    aria-label={c.completed ? "Completed" : `Step ${i + 1}`}
                  >
                    {c.completed ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/courses/${c.item.course.slug}`} className="font-medium hover:text-indigo-600 hover:underline">
                      {c.item.course.title}
                    </Link>
                    {c.item.course.summary ? <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{c.item.course.summary}</p> : null}
                    <div className="mt-1 text-xs text-zinc-500">
                      {cs.lessonCount} lessons · {formatDuration(cs.durationMin)}
                      {c.enrolled ? <> · {c.completed ? "Completed" : `${c.progressPct}% done`}</> : null}
                    </div>
                    {c.enrolled && !c.completed ? <ProgressBar value={c.progressPct} className="mt-2 max-w-xs" /> : null}
                  </div>
                </li>
              );
            })}
            {progress.courses.length === 0 ? <li className="text-sm text-zinc-500">No courses in this path yet.</li> : null}
          </ol>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            {progress.started ? (
              <>
                <div className="text-sm text-zinc-500">Path progress</div>
                <div className="mt-1 text-2xl font-semibold">
                  {progress.completedCount} / {progress.courses.length} courses
                </div>
                <ProgressBar value={progress.progressPct} className="mt-3" />
                {progress.completed ? (
                  <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">🎉 You completed this path.</div>
                ) : (
                  <form action={startPath}>
                    <input type="hidden" name="slug" value={path.slug} />
                    <SubmitButton className="mt-4 w-full" pendingText="Opening…">
                      Continue path
                    </SubmitButton>
                  </form>
                )}
              </>
            ) : user ? (
              <form action={startPath}>
                <input type="hidden" name="slug" value={path.slug} />
                <div className="text-sm text-zinc-500">Self-paced</div>
                <div className="mt-1 text-lg font-semibold">Ready to start?</div>
                <SubmitButton className="mt-4 w-full" pendingText="Starting…">
                  Start path
                </SubmitButton>
              </form>
            ) : (
              <>
                <div className="text-lg font-semibold">Ready to start?</div>
                <LinkButton href={`/login?next=/paths/${path.slug}`} className="mt-4 w-full">
                  Sign in to start
                </LinkButton>
              </>
            )}
            {isEditor ? (
              <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <LinkButton href={`/author/paths/${path.id}`} variant="secondary" size="sm">
                  Edit path
                </LinkButton>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
