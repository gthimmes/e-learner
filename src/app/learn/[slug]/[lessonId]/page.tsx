import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditCourse } from "@/lib/courses";
import { getLearnerContext, isLessonUnlocked } from "@/lib/learning";
import { completeLesson, uncompleteLesson } from "@/lib/actions/learning";
import { Markdown } from "@/components/Markdown";
import { MediaPlayer } from "@/components/MediaPlayer";
import { TrackLesson } from "@/components/TrackLesson";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, LinkButton, ProgressBar } from "@/components/ui";
import { LESSON_TYPE_ICONS, LESSON_TYPE_LABELS, type LessonType } from "@/lib/constants";
import { cn, formatDuration } from "@/lib/utils";

export default async function LessonPlayerPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/learn/${slug}/${lessonId}`);
  const ctx = await getLearnerContext(user.id, slug);
  if (!ctx) notFound();
  const isAuthor = canEditCourse(user, ctx.course);
  if (!ctx.enrollment && !isAuthor) redirect(`/courses/${slug}`);
  if (ctx.course.status !== "PUBLISHED" && !isAuthor) notFound();

  const idx = ctx.lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) notFound();
  const lesson = ctx.lessons[idx]!;
  const prev = ctx.lessons[idx - 1];
  const next = ctx.lessons[idx + 1];
  const isDone = ctx.completed.has(lesson.id);
  const unlocked = isLessonUnlocked(ctx, lesson.id) || isAuthor;
  const doneCount = ctx.lessons.filter((l) => ctx.completed.has(l.id)).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      {ctx.enrollment ? <TrackLesson lessonId={lesson.id} /> : null}

      {/* Outline (LEARN-3) */}
      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-80 lg:self-start">
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 p-4 dark:border-zinc-800">
            <Link href={`/courses/${slug}`} className="text-xs text-zinc-500 hover:underline">
              ← Course page
            </Link>
            <h2 className="mt-1 font-semibold leading-snug">{ctx.course.title}</h2>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {doneCount}/{ctx.lessons.length} complete
              </span>
              <span>{ctx.progressPct}%</span>
            </div>
            <ProgressBar value={ctx.progressPct} className="mt-1.5" />
          </div>
          <nav className="max-h-[60vh] overflow-y-auto p-2 lg:max-h-[calc(100vh-14rem)]" aria-label="Course outline">
            {ctx.course.modules.map((m, mi) => (
              <div key={m.id} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {mi + 1}. {m.title}
                </div>
                <ul>
                  {m.lessons.map((l) => {
                    const active = l.id === lesson.id;
                    const done = ctx.completed.has(l.id);
                    const locked = !(isLessonUnlocked(ctx, l.id) || isAuthor);
                    return (
                      <li key={l.id}>
                        <Link
                          href={locked ? "#" : `/learn/${slug}/${l.id}`}
                          aria-current={active ? "page" : undefined}
                          aria-disabled={locked}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                            active ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                            locked && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px]",
                              done ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 dark:border-zinc-600",
                            )}
                            aria-label={done ? "Completed" : "Not completed"}
                          >
                            {done ? "✓" : locked ? "🔒" : ""}
                          </span>
                          <span className="truncate">{l.title}</span>
                          <span className="ml-auto shrink-0 text-xs text-zinc-400">{LESSON_TYPE_ICONS[l.type as LessonType]}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Lesson content */}
      <article className="min-w-0 flex-1">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{lesson.moduleTitle}</span>
            <span>·</span>
            <span>
              {LESSON_TYPE_ICONS[lesson.type as LessonType]} {LESSON_TYPE_LABELS[lesson.type as LessonType]}
            </span>
            <span>·</span>
            <span>{formatDuration(lesson.durationMin)}</span>
            {isDone ? <Badge tone="success">Completed</Badge> : null}
            {isAuthor && !ctx.enrollment ? <Badge tone="info">Author preview</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>

          {!unlocked ? (
            <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              🔒 Complete the previous lessons to unlock this one.
            </p>
          ) : (
            <>
              <MediaPlayer type={lesson.type} url={lesson.mediaUrl} caption={lesson.mediaCaption} title={lesson.title} />
              <div className="mt-6">
                <Markdown>{lesson.body}</Markdown>
              </div>
              {lesson.type === "QUIZ" ? (
                <p className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Quizzes arrive in the next release. This lesson will be completed by passing the quiz.
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Navigation (LEARN-4, LEARN-5) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {prev ? (
            <LinkButton href={`/learn/${slug}/${prev.id}`} variant="secondary">
              ← {prev.title}
            </LinkButton>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {ctx.enrollment && unlocked && lesson.type !== "QUIZ" ? (
              isDone ? (
                <>
                  <form action={uncompleteLesson}>
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <SubmitButton variant="ghost" size="sm" pendingText="Updating…">
                      Mark incomplete
                    </SubmitButton>
                  </form>
                  {next ? (
                    <LinkButton href={`/learn/${slug}/${next.id}`}>Next: {next.title} →</LinkButton>
                  ) : (
                    <LinkButton href={`/learn/${slug}/done`}>Finish →</LinkButton>
                  )}
                </>
              ) : (
                <form action={completeLesson}>
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <input type="hidden" name="nextLessonId" value={next?.id ?? ""} />
                  <SubmitButton pendingText="Saving…">{next ? "Mark complete & continue →" : "Mark complete & finish →"}</SubmitButton>
                </form>
              )
            ) : next ? (
              <LinkButton href={`/learn/${slug}/${next.id}`}>Next: {next.title} →</LinkButton>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
