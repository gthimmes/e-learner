import { submitQuiz } from "@/lib/actions/quiz";
import { getAttempt, getAttempts, getQuestions, getQuizForLearner } from "@/lib/quiz";
import { Markdown } from "./Markdown";
import { SubmitButton } from "./SubmitButton";
import { Alert, Badge, LinkButton } from "./ui";
import { formatDate } from "@/lib/utils";

type Lesson = { id: string; passingScore: number; maxAttempts: number; shuffleQuestions: boolean; showAnswers: boolean };

/**
 * Learner-facing quiz: shows the attempt result when `?attempt=` is present,
 * otherwise the question form (QUIZ-2..6).
 */
export async function QuizPlayer({
  lesson,
  enrollmentId,
  attemptId,
  basePath,
}: {
  lesson: Lesson;
  enrollmentId: string | null;
  attemptId?: string;
  basePath: string;
}) {
  if (!enrollmentId) {
    const preview = await getQuizForLearner(lesson.id, false);
    return (
      <div className="mt-6 space-y-3">
        <Alert tone="info">Author preview — enroll as a learner to take the quiz. {preview.length} question(s), pass mark {lesson.passingScore}%.</Alert>
      </div>
    );
  }

  const attempts = await getAttempts(enrollmentId, lesson.id);
  const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
  const passedEver = attempts.some((a) => a.passed);
  const remaining = lesson.maxAttempts > 0 ? Math.max(0, lesson.maxAttempts - attempts.length) : null;

  // ----- Result view -----
  const attempt = attemptId ? await getAttempt(attemptId, enrollmentId) : null;
  if (attempt) {
    const questions = await getQuestions(lesson.id);
    const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
    return (
      <div className="mt-6 space-y-6">
        <div className={`rounded-xl p-5 ${attempt.passed ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-amber-50 dark:bg-amber-950/40"}`}>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Your score</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-semibold">{attempt.score}%</span>
            <Badge tone={attempt.passed ? "success" : "warning"}>{attempt.passed ? "Passed" : `Not passed — need ${lesson.passingScore}%`}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!attempt.passed && (remaining === null || remaining > 0) ? (
              <LinkButton href={basePath} variant="secondary" size="sm">
                Try again{remaining !== null ? ` (${remaining} left)` : ""}
              </LinkButton>
            ) : null}
          </div>
        </div>

        <ol className="space-y-4">
          {questions.map((q, i) => {
            const a = byQ.get(q.id);
            let response: string | string[] = "";
            try {
              response = a ? (JSON.parse(a.response) as string | string[]) : "";
            } catch {
              response = a?.response ?? "";
            }
            const chosen = new Set(Array.isArray(response) ? response : response ? [response] : []);
            return (
              <li key={q.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs text-white ${a?.correct ? "bg-emerald-600" : "bg-red-500"}`}>{a?.correct ? "✓" : "✕"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-500">
                      Question {i + 1} · {q.points} pt
                    </div>
                    <Markdown>{q.prompt}</Markdown>
                    {q.type === "SHORT" ? (
                      <div className="mt-2 text-sm">
                        Your answer: <span className="font-medium">{(Array.isArray(response) ? response[0] : response) || "—"}</span>
                        {lesson.showAnswers && !a?.correct ? (
                          <span className="ml-2 text-zinc-500">
                            Accepted: {q.answerText.split("\n").filter(Boolean).join(" / ")}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.choices.map((c) => {
                          const picked = chosen.has(c.id);
                          const reveal = lesson.showAnswers && c.isCorrect;
                          return (
                            <li key={c.id} className={`flex items-center gap-2 rounded px-2 py-1 ${reveal ? "bg-emerald-50 dark:bg-emerald-950/40" : picked ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
                              <span className="w-4 text-center text-xs">{picked ? "●" : "○"}</span>
                              <span>{c.text}</span>
                              {reveal ? <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-400">correct</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {q.explanation ? <p className="mt-2 rounded bg-zinc-50 p-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">💡 {q.explanation}</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <AttemptHistory attempts={attempts} best={best} basePath={basePath} />
      </div>
    );
  }

  // ----- Take view -----
  const questions = await getQuizForLearner(lesson.id, lesson.shuffleQuestions);
  if (questions.length === 0) {
    return <Alert tone="info">This quiz has no questions yet.</Alert>;
  }
  if (remaining === 0 && !passedEver) {
    return (
      <div className="mt-6 space-y-4">
        <Alert>You have used all {lesson.maxAttempts} attempts. Best score: {best}%.</Alert>
        <AttemptHistory attempts={attempts} best={best} basePath={basePath} />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
        <span>{questions.length} questions</span>
        <span>·</span>
        <span>Pass mark {lesson.passingScore}%</span>
        {remaining !== null ? (
          <>
            <span>·</span>
            <span>{remaining} attempt(s) remaining</span>
          </>
        ) : null}
        {passedEver ? <Badge tone="success">Passed · best {best}%</Badge> : null}
      </div>

      <form action={submitQuiz} className="space-y-4">
        <input type="hidden" name="lessonId" value={lesson.id} />
        {questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-xs text-zinc-500">
              Question {i + 1} · {q.points} pt
            </legend>
            <Markdown>{q.prompt}</Markdown>
            {q.type === "SHORT" ? (
              <input
                name={`q_${q.id}`}
                className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Your answer"
                autoComplete="off"
              />
            ) : (
              <ul className="mt-3 space-y-2">
                {q.choices.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                      <input type={q.type === "MULTI" ? "checkbox" : "radio"} name={`q_${q.id}`} value={c.id} />
                      <span>{c.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        ))}
        <div className="flex justify-end">
          <SubmitButton pendingText="Grading…">Submit answers</SubmitButton>
        </div>
      </form>

      <AttemptHistory attempts={attempts} best={best} basePath={basePath} />
    </div>
  );
}

function AttemptHistory({ attempts, best, basePath }: { attempts: Array<{ id: string; score: number; passed: boolean; submittedAt: Date }>; best: number; basePath: string }) {
  if (attempts.length === 0) return null;
  return (
    <details className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer font-medium">
        Attempt history ({attempts.length}) · best {best}%
      </summary>
      <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {attempts.map((a, i) => (
          <li key={a.id} className="flex items-center justify-between py-2">
            <a href={`${basePath}?attempt=${a.id}`} className="hover:underline">
              Attempt {attempts.length - i} · {formatDate(a.submittedAt)}
            </a>
            <span className="flex items-center gap-2">
              {a.score}% <Badge tone={a.passed ? "success" : "neutral"}>{a.passed ? "Passed" : "Not passed"}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
