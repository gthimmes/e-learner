import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseBySlug, courseStats, canEditCourse, canViewCourse } from "@/lib/courses";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnrollment } from "@/lib/learning";
import { enroll } from "@/lib/actions/learning";
import { finalizePurchase, formatMoney, payments } from "@/lib/payments";
import { Markdown } from "@/components/Markdown";
import { BuyForm } from "@/components/CommerceForms";
import { Alert, Badge, Card, LinkButton, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { COURSE_LEVEL_LABELS, LESSON_TYPE_ICONS, type CourseLevel, type LessonType } from "@/lib/constants";
import { formatDate, formatDuration, pct } from "@/lib/utils";
import { getCourseReviews, getMyReview, ratingsFor, splitTags } from "@/lib/discovery";
import { deleteReview } from "@/lib/actions/reviews";
import { ReviewForm, Stars } from "@/components/Rating";

export default async function CourseLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchase?: string; session_id?: string }>;
}) {
  const [{ slug }, { purchase, session_id }] = await Promise.all([params, searchParams]);
  const [course, user] = await Promise.all([getCourseBySlug(slug), getCurrentUser()]);
  if (!course) notFound();
  const isAuthor = !!user && canEditCourse(user, course);
  if (!canViewCourse(user, course)) notFound(); // draft, or private to another organization

  // Returning from checkout: confirm with the provider in case the webhook hasn't arrived yet.
  if (purchase === "success" && session_id && user) {
    const p = await db.purchase.findUnique({ where: { providerSessionId: session_id } });
    if (p && p.userId === user.id && p.status === "PENDING") {
      const v = await payments.verifySession(session_id);
      if (v.paid) await finalizePurchase(p.id, v.paymentId);
    }
  }

  const stats = courseStats(course);
  const enrollment = user ? await getEnrollment(user.id, course.id) : null;
  const progress = enrollment ? pct(enrollment.progress.length, stats.lessonCount) : 0;
  const isPaid = course.priceCents > 0;
  const priceLabel = formatMoney(course.priceCents, course.currency);
  const [reviews, ratings, myReview] = await Promise.all([getCourseReviews(course.id), ratingsFor([course.id]), user ? getMyReview(user.id, course.id) : null]);
  const rating = ratings.get(course.id) ?? { avg: 0, count: 0 };
  const tags = splitTags(course.tags);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {purchase === "success" && enrollment ? (
        <div className="mb-6">
          <Alert tone="success">Payment received — you&apos;re enrolled. Enjoy the course!</Alert>
        </div>
      ) : purchase === "canceled" ? (
        <div className="mb-6">
          <Alert tone="info">Checkout canceled. You can try again whenever you like.</Alert>
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 flex items-center gap-2">
            {course.status !== "PUBLISHED" ? <StatusBadge status={course.status} /> : null}
            {course.organization ? <Badge tone="info">🔒 {course.organization.name} only</Badge> : null}
            {isAuthor ? <Badge tone="info">You are the author</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{course.title}</h1>
          {course.summary ? <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-300">{course.summary}</p> : null}
          <p className="mt-2 text-sm text-zinc-500">
            By {course.instructor.name} · {stats.moduleCount} module{stats.moduleCount === 1 ? "" : "s"} · {stats.lessonCount} lesson
            {stats.lessonCount === 1 ? "" : "s"} · {formatDuration(stats.durationMin)}
            {course.level !== "ALL" ? <> · {COURSE_LEVEL_LABELS[course.level as CourseLevel]}</> : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a href="#reviews" className="hover:underline">
              <Stars value={rating.avg} count={rating.count} size="lg" />
            </a>
            {tags.map((t) => (
              <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-zinc-800 dark:text-zinc-300">
                #{t}
              </Link>
            ))}
          </div>

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

          <section id="reviews" className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Reviews</h2>
              <Stars value={rating.avg} count={rating.count} />
            </div>
            {enrollment ? (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-medium">{myReview ? "Your review" : "Rate this course"}</h3>
                <ReviewForm courseId={course.id} existing={myReview ? { rating: myReview.rating, body: myReview.body } : null} />
              </div>
            ) : null}
            {reviews.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No reviews yet{enrollment ? " — be the first." : "."}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{r.user.name}</span>
                        <span className="text-amber-500" aria-label={`${r.rating} out of 5`}>
                          {"★".repeat(r.rating)}
                          <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - r.rating)}</span>
                        </span>
                        <span className="text-xs text-zinc-400">{formatDate(r.createdAt)}</span>
                      </div>
                      {user && (r.userId === user.id || isAuthor) ? (
                        <form action={deleteReview}>
                          <input type="hidden" name="reviewId" value={r.id} />
                          <button className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
                        </form>
                      ) : null}
                    </div>
                    {r.body ? <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{r.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
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
            ) : course.status !== "PUBLISHED" ? (
              <>
                <div className="text-lg font-semibold">Not yet published</div>
                <p className="mt-3 text-sm text-zinc-500">Publish the course to open enrollment.</p>
              </>
            ) : isPaid ? (
              <BuyForm courseId={course.id} priceLabel={priceLabel} signedIn={!!user} />
            ) : (
              <form action={enroll}>
                <input type="hidden" name="courseId" value={course.id} />
                <div className="text-sm text-zinc-500">Free · self-paced</div>
                <div className="mt-1 text-lg font-semibold">Ready to start?</div>
                <SubmitButton className="mt-4 w-full" pendingText="Enrolling…">
                  {user ? "Enroll now" : "Sign in to enroll"}
                </SubmitButton>
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
