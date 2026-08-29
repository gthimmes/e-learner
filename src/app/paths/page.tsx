import Link from "next/link";
import { getCurrentUser, canAuthor } from "@/lib/auth";
import { getPublishedPaths } from "@/lib/discovery";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatDuration } from "@/lib/utils";

export const metadata = { title: "Learning paths" };

export default async function PathsPage() {
  const user = await getCurrentUser();
  const paths = await getPublishedPaths(user);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Learning paths"
        subtitle="Curated sequences of courses that take you from first steps to mastery."
        actions={canAuthor(user) ? <LinkButton href="/author/paths">Manage paths</LinkButton> : null}
      />
      {paths.length === 0 ? (
        <EmptyState title="No learning paths yet" body="Instructors can bundle courses into a path from the author dashboard." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {paths.map((p) => (
            <Link
              key={p.id}
              href={`/paths/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="aspect-[21/9] w-full bg-gradient-to-br from-emerald-500 to-teal-600">
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-lg font-semibold group-hover:text-indigo-600">{p.title}</h2>
                {p.summary ? <p className="mt-1 text-sm text-zinc-500">{p.summary}</p> : null}
                <ol className="mt-3 space-y-1 text-sm">
                  {p.items.map((it, i) => (
                    <li key={it.id} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{i + 1}</span>
                      {it.course.title}
                    </li>
                  ))}
                </ol>
                <div className="mt-auto flex items-center justify-between pt-3 text-xs text-zinc-500">
                  <span>
                    {p.stats.courseCount} course{p.stats.courseCount === 1 ? "" : "s"} · {p.stats.lessonCount} lessons · {formatDuration(p.stats.durationMin)}
                  </span>
                  {p.organizationId ? <Badge tone="info">🔒 Organization</Badge> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
