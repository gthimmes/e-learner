import { requireUser } from "@/lib/auth";
import { getMyEnrollments } from "@/lib/learning";
import { CourseCard } from "@/components/CourseCard";
import { Badge, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My Learning" };

type Enrollments = Awaited<ReturnType<typeof getMyEnrollments>>;

function EnrollmentGrid({ items }: { items: Enrollments }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((e) => (
        <CourseCard
          key={e.id}
          href={`/learn/${e.course.slug}`}
          title={e.course.title}
          summary={e.course.summary}
          coverUrl={e.course.coverUrl}
          instructor={e.course.instructor.name}
          lessonCount={e.stats.lessonCount}
          durationMin={e.stats.durationMin}
          footer={
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  {e.done}/{e.stats.lessonCount} lessons
                </span>
                {e.completedAt ? <Badge tone="success">Completed</Badge> : <span className="font-medium">{e.progressPct}%</span>}
              </div>
              {e.cohort?.dueAt && !e.completedAt ? (
                <div className="text-xs">
                  {e.overdue ? <Badge tone="warning">Overdue · was due {formatDate(e.cohort.dueAt)}</Badge> : <span className="text-zinc-500">Due {formatDate(e.cohort.dueAt)} · {e.cohort.name}</span>}
                </div>
              ) : null}
              <ProgressBar value={e.progressPct} />
            </div>
          }
        />
      ))}
    </div>
  );
}

export default async function MyLearningPage() {
  const user = await requireUser("/learn");
  const enrollments = await getMyEnrollments(user.id);
  const active = enrollments.filter((e) => !e.completedAt);
  const completed = enrollments.filter((e) => e.completedAt);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="My Learning" subtitle={`Welcome back, ${user.name.split(" ")[0]}.`} actions={<LinkButton href="/" variant="secondary">Browse catalog</LinkButton>} />
      {enrollments.length === 0 ? (
        <EmptyState title="You're not enrolled in any courses yet" body="Pick something from the catalog to get started." action={<LinkButton href="/">Browse the catalog</LinkButton>} />
      ) : (
        <div className="space-y-10">
          {active.length ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold">In progress</h2>
              <EnrollmentGrid items={active} />
            </section>
          ) : null}
          {completed.length ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold">Completed</h2>
              <EnrollmentGrid items={completed} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
