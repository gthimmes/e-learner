import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getAuthorCourses } from "@/lib/courses";
import { getPathForAuthor } from "@/lib/discovery";
import { addPathCourse, deletePath, movePathCourse, removePathCourse, setPathStatus } from "@/lib/actions/paths";
import { PathForm } from "@/components/PathForms";
import { Alert, Button, Card, LinkButton, PageHeader, Select, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Edit learning path" };

export default async function EditPathPage({ params, searchParams }: { params: Promise<{ pathId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ pathId }, { error }] = await Promise.all([params, searchParams]);
  const user = await requireRole(`/author/paths/${pathId}`, "INSTRUCTOR", "ADMIN");
  const [path, courses] = await Promise.all([getPathForAuthor(pathId, user), getAuthorCourses(user)]);
  if (!path) notFound();
  const inPath = new Set(path.items.map((i) => i.courseId));
  const addable = courses.filter((c) => !inPath.has(c.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-2 text-sm text-zinc-500">
        <Link href="/author/paths" className="hover:underline">
          Learning paths
        </Link>{" "}
        / {path.title}
      </div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {path.title} <StatusBadge status={path.status} />
          </span>
        }
        subtitle={`/paths/${path.slug}`}
        actions={
          <>
            <LinkButton href={`/paths/${path.slug}`} variant="secondary">
              View
            </LinkButton>
            <form action={setPathStatus}>
              <input type="hidden" name="pathId" value={path.id} />
              <input type="hidden" name="status" value={path.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
              <SubmitButton pendingText="Saving…" variant={path.status === "PUBLISHED" ? "secondary" : "primary"}>
                {path.status === "PUBLISHED" ? "Unpublish" : "Publish path"}
              </SubmitButton>
            </form>
          </>
        }
      />
      {error ? (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Courses in order</h2>
            {path.items.length === 0 ? <p className="text-sm text-zinc-500">No courses yet. Add one from the panel on the right.</p> : null}
            <ol className="space-y-2">
              {path.items.map((it, i) => (
                <li key={it.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/author/${it.courseId}`} className="font-medium hover:text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
                      {it.course.title}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      <StatusBadge status={it.course.status} />
                    </div>
                  </div>
                  <form action={movePathCourse}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <input type="hidden" name="dir" value="up" />
                    <Button variant="ghost" size="sm" disabled={i === 0} aria-label="Move up">
                      ↑
                    </Button>
                  </form>
                  <form action={movePathCourse}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <input type="hidden" name="dir" value="down" />
                    <Button variant="ghost" size="sm" disabled={i === path.items.length - 1} aria-label="Move down">
                      ↓
                    </Button>
                  </form>
                  <form action={removePathCourse}>
                    <input type="hidden" name="itemId" value={it.id} />
                    <Button variant="ghost" size="sm" aria-label={`Remove ${it.course.title}`}>
                      ✕
                    </Button>
                  </form>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Details</h2>
            <PathForm mode="edit" path={path} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Add a course</h2>
            {addable.length === 0 ? (
              <p className="text-sm text-zinc-500">All your courses are already in this path.</p>
            ) : (
              <form action={addPathCourse} className="flex gap-2">
                <input type="hidden" name="pathId" value={path.id} />
                <Select name="courseId" aria-label="Course" className="min-w-0 flex-1">
                  {addable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status.toLowerCase()})
                    </option>
                  ))}
                </Select>
                <SubmitButton pendingText="Adding…" size="sm">
                  Add
                </SubmitButton>
              </form>
            )}
            <p className="mt-3 text-xs text-zinc-500">Learners only see published courses in a path; draft courses are hidden until published.</p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Danger zone</h2>
            <form action={deletePath}>
              <input type="hidden" name="pathId" value={path.id} />
              <SubmitButton variant="danger" size="sm" pendingText="Deleting…">
                Delete path
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
