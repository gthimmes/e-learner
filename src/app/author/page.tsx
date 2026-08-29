import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getAuthorCourses } from "@/lib/courses";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatDuration, pct } from "@/lib/utils";

export const metadata = { title: "Author dashboard" };

export default async function AuthorDashboard() {
  const user = await requireRole("/author", "INSTRUCTOR", "ADMIN");
  const courses = await getAuthorCourses(user);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Your courses"
        subtitle={user.role === "ADMIN" ? "All courses on the platform (admin view)." : "Draft, publish and track your courses."}
        actions={
          <>
            <LinkButton href="/author/paths" variant="secondary">
              Learning paths
            </LinkButton>
            <LinkButton href="/author/new">New course</LinkButton>
          </>
        }
      />
      {courses.length === 0 ? (
        <EmptyState title="No courses yet" body="Create your first course — a title is all you need to start." action={<LinkButton href="/author/new">Create a course</LinkButton>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Completion</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {courses.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/author/${c.id}`} className="font-medium hover:text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
                      {c.title}
                    </Link>
                    {user.role === "ADMIN" && c.instructor.id !== user.id ? <div className="text-xs text-zinc-500">by {c.instructor.name}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {c.stats.moduleCount} mod · {c.stats.lessonCount} lessons · {formatDuration(c.stats.durationMin)}
                  </td>
                  <td className="px-4 py-3">{c.enrollmentCount}</td>
                  <td className="px-4 py-3">{c.enrollmentCount ? `${pct(c.completedCount, c.enrollmentCount)}%` : "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(c.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/author/${c.id}/learners`} className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
                      Learners
                    </Link>
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
