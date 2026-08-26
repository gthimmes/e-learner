import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseBySlug, courseStats, canEditCourse } from "@/lib/courses";
import { getCurrentUser } from "@/lib/auth";
import { getEnrollment } from "@/lib/learning";
import { enroll } from "@/lib/actions/learning";
import { Markdown } from "@/components/Markdown";
import { Badge, Card, LinkButton, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { LESSON_TYPE_ICONS, type LessonType } from "@/lib/constants";
import { formatDuration, pct } from "@/lib/utils";

export default async function CourseLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [course, user] = await Promise.all([getCourseBySlug(slug), getCurrentUser()]);
  if (!course) notFound();
  const isAuthor = !!user && canEditCourse(user, course);
  if (course.status !== "PUBLISHED" && !isAuthor) notFound();

  const stats = courseStats(course);
  const enrollment = user ? await getEnrollment(user.id, course.id) : null;
  const progress = enrollment ? pct(enrollment.progress.length, stats.lessonCount) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 flex items-center gap-2">
            {course.status !== "PUBLISHED" ? <StatusBadge status={course.status} /> : null}
            {isAuthor ? <Badge tone="info">You are the author</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{course.title}</h1>
          {course.summary ? <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-300">{course.summary}</p> : null}
          <p className="mt-2 text-sm text-zinc-500">
            By {course.instructor.name} · {stats.moduleCount} module{stats.moduleCount === 1 ? "" : "s"} · {stats.lessonCount} lesson
            {stats.lessonCount === 1 ? "" : "s"} · {formatDuration(stats.durationMin)}
          </p>

          {course.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverUrl} alt="" className="mt-6 aspect-[21/9] w-full rounded-xl object-cover" />
          ) : null}

          <div className="mt-8">
            <Markdown>{course.description}</Markdown>
          </div>

          <h2 className="mt-10 text-xl font-semibold">Course outline</h2>
          <ol className="mt-4 space-y-4">
            {course.modules.map((m, i) => (
              <li key={m.id} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Module {i + 1}</div>
                  <div className="font-medium">{m.title}</div>
                  {m.summary ? <div className="text-sm text-zinc-500">{m.summary}</div> : null}
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span aria-hidden>{LESSON_TYPE_ICONS[l.type as LessonType]}</span>
                        {enrollment || isAuthor ? (
                          <Link href={`/learn/${course.slug}/${l.id}`} className="hover:text-indigo-600 hover:underline">
                            {l.title}
                          </Link>
                        ) : (
                          l.title
                        )}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDuration(l.durationMin)}</span>
                    </li>
                  ))}
                  {m.lessons.length === 0 ? <li className="px-4 py-2.5 text-sm text-zinc-400">No lessons yet</li> : null}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            {enrollment ? (
              <>
                <div className="text-sm text-zinc-500">Your progress</div>
                <div className="mt-1 text-2xl font-semibold">{progress}%</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-indigo-600" style={{ width: `${progress}%` }} />
                </div>
                <LinkButton href={`/learn/${course.slug}`} className="mt-4 w-full">
                  {enrollment.completedAt ? "Review course" : progress > 0 ? "Continue learning" : "Start course"}
                </LinkButton>
              </>
            ) : (
              <form action={enroll}>
                <input type="hidden" name="courseId" value={course.id} />
                <div className="text-sm text-zinc-500">Free · self-paced</div>
                <div className="mt-1 text-lg font-semibold">Ready to start?</div>
                {course.status === "PUBLISHED" ? (
                  <SubmitButton className="mt-4 w-full" pendingText="Enrolling…">
                    {user ? "Enroll now" : "Sign in to enroll"}
                  </SubmitButton>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">Publish the course to open enrollment.</p>
                )}
              </form>
            )}
            {isAuthor ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <LinkButton href={`/author/${course.id}`} variant="secondary" size="sm">
                  Edit course
                </LinkButton>
                <LinkButton href={`/learn/${course.slug}`} variant="ghost" size="sm">
                  Preview as learner
                </LinkButton>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
