import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getAuthorPaths } from "@/lib/discovery";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/utils";

export const metadata = { title: "Learning paths" };

export default async function AuthorPathsPage() {
  const user = await requireRole("/author/paths", "INSTRUCTOR", "ADMIN");
  const paths = await getAuthorPaths(user);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Learning paths"
        subtitle="Bundle courses into an ordered journey. Learners see path progress across courses."
        actions={
          <>
            <LinkButton href="/author" variant="secondary">
              Courses
            </LinkButton>
            <LinkButton href="/author/paths/new">New path</LinkButton>
          </>
        }
      />
      {paths.length === 0 ? (
        <EmptyState title="No learning paths yet" body="Create a path and add two or more of your courses in order." action={<LinkButton href="/author/paths/new">Create a path</LinkButton>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3">Learners</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paths.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/author/paths/${p.id}`} className="font-medium hover:text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {p.stats.courseCount} courses · {p.stats.lessonCount} lessons · {formatDuration(p.stats.durationMin)}
                  </td>
                  <td className="px-4 py-3">{p._count.enrollments}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
