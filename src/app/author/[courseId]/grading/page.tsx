import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor } from "@/lib/courses";
import { getPendingGrading } from "@/lib/quiz";
import { gradeAnswer } from "@/lib/actions/quiz";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, EmptyState, Input, Label, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Grading" };

/** Instructor queue of essay answers awaiting a grade (QUIZ-7). */
export default async function GradingPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/grading`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const queue = await getPendingGrading(courseId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 text-sm text-zinc-500">
        <Link href={`/author/${course.id}`} className="hover:underline">
          {course.title}
        </Link>{" "}
        / Grading
      </div>
      <PageHeader
        title="Grading queue"
        subtitle={queue.length ? `${queue.length} attempt${queue.length === 1 ? "" : "s"} with essay answers waiting for a grade.` : "Essay answers land here when learners submit."}
        actions={
          <LinkButton href={`/author/${course.id}`} variant="secondary">
            ← Back to editor
          </LinkButton>
        }
      />

      {queue.length === 0 ? (
        <EmptyState title="Nothing to grade" body="You're all caught up. Learners see their provisional score until you grade their essays." />
      ) : (
        <ol className="space-y-6">
          {queue.map((a) => (
            <li key={a.id} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-medium">{a.enrollment.user.name}</div>
                  <div className="text-xs text-zinc-500">
                    {a.enrollment.user.email} · {a.lesson.title} · submitted {formatDate(a.submittedAt)}
                  </div>
                </div>
                <div className="text-sm text-zinc-500">
                  Provisional {a.score}% · pass mark {a.lesson.passingScore}% <Badge tone="info">Awaiting grading</Badge>
                </div>
              </div>
              <ol className="mt-4 space-y-4">
                {a.essays.map((ans, i) => (
                  <li key={ans.id} className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500">
                      Essay {i + 1} · up to {ans.question.points} pt
                    </div>
                    <Markdown>{ans.question.prompt}</Markdown>
                    {ans.question.rubric ? <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Rubric: {ans.question.rubric}</p> : null}
                    <blockquote className="mt-3 whitespace-pre-line rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">{parseText(ans.response) || "—"}</blockquote>
                    <form action={gradeAnswer} className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr_auto] sm:items-end">
                      <input type="hidden" name="answerId" value={ans.id} />
                      <div>
                        <Label htmlFor={`pts-${ans.id}`}>Points</Label>
                        <Input id={`pts-${ans.id}`} name="points" type="number" min={0} max={ans.question.points} defaultValue={ans.pointsAwarded ?? ""} required />
                      </div>
                      <div>
                        <Label htmlFor={`fb-${ans.id}`} hint="shown to the learner">
                          Feedback
                        </Label>
                        <Textarea id={`fb-${ans.id}`} name="feedback" rows={2} defaultValue={ans.feedback} placeholder="What was strong? What was missing?" />
                      </div>
                      <SubmitButton pendingText="Saving…">{ans.pointsAwarded === null ? "Save grade" : "Update grade"}</SubmitButton>
                    </form>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function parseText(raw: string) {
  try {
    const v = JSON.parse(raw) as string | string[];
    return Array.isArray(v) ? v[0] ?? "" : v;
  } catch {
    return raw;
  }
}
