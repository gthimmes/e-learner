import { requireUser } from "@/lib/auth";
import { getMyEnrollments } from "@/lib/learning";
import { CourseCard } from "@/components/CourseCard";
import { Badge, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { getEngageSummary } from "@/lib/engage";
import { getT } from "@/lib/i18n";

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
  const [enrollments, engage, t] = await Promise.all([getMyEnrollments(user.id), getEngageSummary(user.id), getT()]);
  const active = enrollments.filter((e) => !e.completedAt);
  const completed = enrollments.filter((e) => e.completedAt);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t("learn.title")} subtitle={t("learn.welcome", { name: user.name.split(" ")[0] ?? user.name })} actions={<LinkButton href="/" variant="secondary">{t("learn.browse")}</LinkButton>} />
      <Link href="/me" className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900">
        <span>
          🔥 <strong>{t("learn.streak", { n: engage.streak.current })}</strong>
          {t.locale === "en" ? (engage.streak.activeToday ? "" : engage.streak.current ? " · learn today to keep it" : " · complete a lesson to start one") : ""}
        </span>
        <span>
          ⭐ <strong>{engage.points}</strong> {t("learn.points")}
        </span>
        <span>
          🏅 <strong>{engage.badgeCount}</strong> {t("learn.badges")}
        </span>
        <span className="ml-auto text-indigo-600">{t("learn.profile")}</span>
      </Link>
      {enrollments.length === 0 ? (
        <EmptyState title={t("learn.emptyTitle")} body={t("learn.emptyBody")} action={<LinkButton href="/">{t("learn.browseCta")}</LinkButton>} />
      ) : (
        <div className="space-y-10">
          {active.length ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("learn.inProgress")}</h2>
              <EnrollmentGrid items={active} />
            </section>
          ) : null}
          {completed.length ? (
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("learn.completed")}</h2>
              <EnrollmentGrid items={completed} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
