import { getPublishedCourses } from "@/lib/courses";
import { getCurrentUser, canAuthor } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";
import { Badge, EmptyState, LinkButton, PageHeader, Alert } from "@/components/ui";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [{ denied }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const courses = await getPublishedCourses(user);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {denied ? (
        <div className="mb-6">
          <Alert>You don&apos;t have access to that page.</Alert>
        </div>
      ) : null}
      <PageHeader
        title="Course catalog"
        subtitle="Learn at your own pace. Enroll in a course to start tracking your progress."
        actions={canAuthor(user) ? <LinkButton href="/author/new">Create a course</LinkButton> : null}
      />
      {courses.length === 0 ? (
        <EmptyState
          title="No courses published yet"
          body={
            canAuthor(user)
              ? "Create your first course and publish it to see it here."
              : user
                ? "Check back soon — instructors are still writing."
                : "Sign in or create an account to get started."
          }
          action={
            canAuthor(user) ? <LinkButton href="/author/new">Create a course</LinkButton> : !user ? <LinkButton href="/register">Get started</LinkButton> : null
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              href={`/courses/${c.slug}`}
              title={c.title}
              summary={c.summary}
              coverUrl={c.coverUrl}
              instructor={c.instructor.name}
              lessonCount={c.stats.lessonCount}
              durationMin={c.stats.durationMin}
              footer={c.organization ? <Badge tone="info">🔒 {c.organization.name} only</Badge> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
