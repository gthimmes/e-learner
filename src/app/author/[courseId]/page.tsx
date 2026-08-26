import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor, courseStats } from "@/lib/courses";
import { deleteCourse, setCourseStatus } from "@/lib/actions/courses";
import { CourseForm } from "@/components/CourseForm";
import { CoAuthorForm } from "@/components/OrgForms";
import { removeCoAuthor } from "@/lib/actions/authors";
import { OutlineEditor } from "@/components/OutlineEditor";
import { Alert, Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDuration } from "@/lib/utils";

export default async function CourseEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ courseId }, { error }] = await Promise.all([params, searchParams]);
  const user = await requireRole(`/author/${courseId}`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const stats = courseStats(course);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {course.title} <StatusBadge status={course.status} />
          </span>
        }
        subtitle={`${stats.moduleCount} modules · ${stats.lessonCount} lessons · ${formatDuration(stats.durationMin)} · ${course._count.enrollments} enrolled`}
        actions={
          <>
            <LinkButton href={`/courses/${course.slug}`} variant="secondary">
              View
            </LinkButton>
            <LinkButton href={`/learn/${course.slug}`} variant="secondary">
              Preview as learner
            </LinkButton>
            <LinkButton href={`/author/${course.id}/learners`} variant="secondary">
              Learners
            </LinkButton>
            {course.status === "PUBLISHED" ? (
              <form action={setCourseStatus}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="status" value="DRAFT" />
                <SubmitButton variant="secondary" pendingText="…">
                  Unpublish
                </SubmitButton>
              </form>
            ) : (
              <form action={setCourseStatus}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="status" value="PUBLISHED" />
                <SubmitButton pendingText="Publishing…">Publish</SubmitButton>
              </form>
            )}
          </>
        }
      />

      {error ? (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Outline</h2>
          <OutlineEditor courseId={course.id} modules={course.modules} />
        </section>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Details</h2>
            <CourseForm mode="edit" course={course} />
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Co-authors</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Instructor: {course.instructor.name}
              {course.organization ? ` · private to ${course.organization.name}` : " · public"}
            </p>
            {course.coAuthors.length ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {course.coAuthors.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between gap-2">
                    <span>
                      {a.user.name} <span className="text-xs text-zinc-500">{a.user.email}</span>
                    </span>
                    <form action={removeCoAuthor}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="userId" value={a.userId} />
                      <button className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <CoAuthorForm courseId={course.id} />
            </div>
          </Card>
          <Card className="border-red-200 dark:border-red-900">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
            <p className="mt-1 text-xs text-zinc-500">Deleting removes all modules, lessons, enrollments and progress. This cannot be undone.</p>
            <div className="mt-3 flex gap-2">
              {course.status !== "ARCHIVED" ? (
                <form action={setCourseStatus}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="status" value="ARCHIVED" />
                  <SubmitButton variant="secondary" size="sm" pendingText="…">
                    Archive
                  </SubmitButton>
                </form>
              ) : null}
              <form action={deleteCourse}>
                <input type="hidden" name="courseId" value={course.id} />
                <SubmitButton variant="danger" size="sm" pendingText="Deleting…">
                  Delete course
                </SubmitButton>
              </form>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
