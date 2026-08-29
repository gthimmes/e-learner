import { redirect } from "next/navigation";
import { startQuiz, submitQuiz } from "@/lib/actions/quiz";
import { expireAttempt, getAttempt, getAttempts, getQuestions, getQuizForLearner, parseQuestionIds } from "@/lib/quiz";
import { isExpired } from "@/lib/grading";
import { Markdown } from "./Markdown";
import { SubmitButton } from "./SubmitButton";
import { QuizTimer } from "./QuizTimer";
import { Alert, Badge, LinkButton } from "./ui";
import { formatDate } from "@/lib/utils";

type Lesson = {
  id: string;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  showAnswers: boolean;
  timeLimitMin: number;
  drawCount: number;
};

type AttemptRow = { id: string; score: number; passed: boolean; status: string; submittedAt: Date };

/**
 * Learner-facing quiz (QUIZ-2..9): `?attempt=` shows a result, `?take=` an open timed/drawn
 * attempt, otherwise the question form (or a Start card for timed / drawn quizzes).
 */
export async function QuizPlayer({
  lesson,
  enrollmentId,
  attemptId,
  takeId,
  basePath,
}: {
  lesson: Lesson;
  enrollmentId: string | null;
  attemptId?: string;
  takeId?: string;
  basePath: string;
}) {
  const needsStart = lesson.timeLimitMin > 0 || lesson.drawCount > 0;

  if (!enrollmentId) {
    const preview = await getQuizForLearner(lesson.id, false);
    return (
      <div className="mt-6 space-y-3">
        <Alert tone="info">
          Author preview — enroll as a learner to take the quiz. {preview.length} question(s)
          {lesson.drawCount > 0 && lesson.drawCount < preview.length ? `, ${lesson.drawCount} drawn per attempt` : ""}, pass mark {lesson.passingScore}%
          {lesson.timeLimitMin > 0 ? `, ${lesson.timeLimitMin} min time limit` : ""}.
        </Alert>
      </div>
    );
  }

  const attempts = await getAttempts(enrollmentId, lesson.id);
  const finished = attempts.filter((a) => a.status !== "IN_PROGRESS");
  const best = finished.reduce((m, a) => Math.max(m, a.score), 0);
  const passedEver = finished.some((a) => a.passed);
  const remaining = lesson.maxAttempts > 0 ? Math.max(0, lesson.maxAttempts - attempts.length) : null;

  // ----- Result view -----
  const attempt = attemptId ? await getAttempt(attemptId, enrollmentId) : null;
  if (attempt) {
    if (attempt.status === "IN_PROGRESS") redirect(`${basePath}?take=${attempt.id}`);
    const questions = await getQuestions(lesson.id, parseQuestionIds(attempt.questionIds));
    const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const pending = attempt.status === "PENDING";
    return (
      <div className="mt-6 space-y-6">
        <div className={`rounded-xl p-5 ${attempt.passed ? "bg-emerald-50 dark:bg-emerald-950/40" : pending ? "bg-indigo-50 dark:bg-indigo-950/40" : "bg-amber-50 dark:bg-amber-950/40"}`}>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">{pending ? "Provisional score" : "Your score"}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-semibold">{attempt.score}%</span>
            {pending ? (
              <Badge tone="info">Awaiting grading</Badge>
            ) : (
              <Badge tone={attempt.passed ? "success" : "warning"}>{attempt.passed ? "Passed" : `Not passed — need ${lesson.passingScore}%`}</Badge>
            )}
          </div>
          {pending ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Your essay answer{attempt.answers.filter((a) => a.pointsAwarded === null && questions.find((q) => q.id === a.questionId)?.type === "ESSAY").length === 1 ? " is" : "s are"} waiting
              for your instructor. The score updates automatically once graded.
            </p>
          ) : null}
          {attempt.answers.length === 0 ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Time ran out before this attempt was submitted.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {!attempt.passed && !pending && (remaining === null || remaining > 0) ? (
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
            const text = (Array.isArray(response) ? response[0] : response) || "";
            const chosen = new Set(Array.isArray(response) ? response : response ? [response] : []);
            const essayPending = q.type === "ESSAY" && a && a.pointsAwarded === null;
            const mark = essayPending ? "…" : a?.correct ? "✓" : "✕";
            const markCls = essayPending ? "bg-indigo-500" : a?.correct ? "bg-emerald-600" : "bg-red-500";
            return (
              <li key={q.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs text-white ${markCls}`}>{mark}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-500">
                      Question {i + 1} · {q.points} pt
                    </div>
                    <Markdown>{q.prompt}</Markdown>
                    {q.type === "ESSAY" ? (
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="whitespace-pre-line rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">{text || "—"}</div>
                        {a && a.pointsAwarded !== null ? (
                          <div>
                            <span className="font-medium">
                              {a.pointsAwarded} / {q.points} pts
                            </span>
                            {a.feedback ? <p className="mt-1 whitespace-pre-line text-zinc-600 dark:text-zinc-300">💬 {a.feedback}</p> : null}
                          </div>
                        ) : (
                          <Badge tone="info">Awaiting grading</Badge>
                        )}
                      </div>
                    ) : q.type === "SHORT" ? (
                      <div className="mt-2 text-sm">
                        Your answer: <span className="font-medium">{text || "—"}</span>
                        {lesson.showAnswers && !a?.correct ? <span className="ml-2 text-zinc-500">Accepted: {q.answerText.split("\n").filter(Boolean).join(" / ")}</span> : null}
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
                    {q.explanation && q.type !== "ESSAY" ? <p className="mt-2 rounded bg-zinc-50 p-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">💡 {q.explanation}</p> : null}
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

  // ----- Open attempt (timed / drawn) -----
  let open = takeId ? await getAttempt(takeId, enrollmentId) : null;
  if (takeId && (!open || open.status !== "IN_PROGRESS")) redirect(open ? `${basePath}?attempt=${open.id}` : basePath);
  if (open && isExpired(open.deadline)) {
    await expireAttempt(open.id);
    redirect(`${basePath}?attempt=${open.id}`);
  }
  if (!open && needsStart) {
    const resumable = attempts.find((a) => a.status === "IN_PROGRESS" && !isExpired(a.deadline));
    if (resumable) open = resumable;
  }

  if (!open && needsStart) {
    const bankSize = await getQuestions(lesson.id).then((q) => q.length);
    if (bankSize === 0) return <Alert tone="info">This quiz has no questions yet.</Alert>;
    if (remaining === 0 && !passedEver) {
      return (
        <div className="mt-6 space-y-4">
          <Alert>You have used all {lesson.maxAttempts} attempts. Best score: {best}%.</Alert>
          <AttemptHistory attempts={attempts} best={best} basePath={basePath} />
        </div>
      );
    }
    const drawn = lesson.drawCount > 0 ? Math.min(lesson.drawCount, bankSize) : bankSize;
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold">Ready when you are</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>
              {drawn} question{drawn === 1 ? "" : "s"}
              {drawn < bankSize ? ` drawn from a bank of ${bankSize}` : ""} · pass mark {lesson.passingScore}%
            </li>
            {lesson.timeLimitMin > 0 ? <li>⏱ {lesson.timeLimitMin} minute time limit — the clock starts when you press Start and the quiz submits itself at zero.</li> : null}
            {remaining !== null ? <li>{remaining} attempt(s) remaining</li> : null}
            {passedEver ? (
              <li>
                <Badge tone="success">Passed · best {best}%</Badge>
              </li>
            ) : null}
          </ul>
          <form action={startQuiz} className="mt-4">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <SubmitButton pendingText="Starting…">Start quiz</SubmitButton>
          </form>
        </div>
        <AttemptHistory attempts={attempts} best={best} basePath={basePath} />
      </div>
    );
  }

  // ----- Take view -----
  const questions = await getQuizForLearner(lesson.id, lesson.shuffleQuestions, open ? parseQuestionIds(open.questionIds) : null);
  if (questions.length === 0) return <Alert tone="info">This quiz has no questions yet.</Alert>;
  if (!open && remaining === 0 && !passedEver) {
    return (
      <div className="mt-6 space-y-4">
        <Alert>You have used all {lesson.maxAttempts} attempts. Best score: {best}%.</Alert>
        <AttemptHistory attempts={attempts} best={best} basePath={basePath} />
      </div>
    );
  }
  const formId = `quiz-${lesson.id}`;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
        <span>{questions.length} questions</span>
        <span>·</span>
        <span>Pass mark {lesson.passingScore}%</span>
        {remaining !== null && !open ? (
          <>
            <span>·</span>
            <span>{remaining} attempt(s) remaining</span>
          </>
        ) : null}
        {passedEver ? <Badge tone="success">Passed · best {best}%</Badge> : null}
        {open?.deadline ? <QuizTimer deadline={open.deadline.toISOString()} formId={formId} /> : null}
      </div>

      <form id={formId} action={submitQuiz} className="space-y-4">
        <input type="hidden" name="lessonId" value={lesson.id} />
        {open ? <input type="hidden" name="attemptId" value={open.id} /> : null}
        {questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <legend className="px-1 text-xs text-zinc-500">
              Question {i + 1} · {q.points} pt{q.type === "ESSAY" ? " · graded by your instructor" : ""}
            </legend>
            <Markdown>{q.prompt}</Markdown>
            {q.type === "ESSAY" ? (
              <textarea
                name={`q_${q.id}`}
                rows={6}
                className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Write your answer…"
                aria-label={`Answer to question ${i + 1}`}
              />
            ) : q.type === "SHORT" ? (
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

function AttemptHistory({ attempts, best, basePath }: { attempts: AttemptRow[]; best: number; basePath: string }) {
  if (attempts.length === 0) return null;
  return (
    <details className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer font-medium">
        Attempt history ({attempts.length}) · best {best}%
      </summary>
      <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {attempts.map((a, i) => (
          <li key={a.id} className="flex items-center justify-between py-2">
            <a href={`${basePath}?${a.status === "IN_PROGRESS" ? "take" : "attempt"}=${a.id}`} className="hover:underline">
              Attempt {attempts.length - i} · {formatDate(a.submittedAt)}
            </a>
            <span className="flex items-center gap-2">
              {a.status === "IN_PROGRESS" ? (
                <Badge tone="warning">In progress</Badge>
              ) : a.status === "PENDING" ? (
                <>
                  {a.score}% <Badge tone="info">Awaiting grading</Badge>
                </>
              ) : (
                <>
                  {a.score}% <Badge tone={a.passed ? "success" : "neutral"}>{a.passed ? "Passed" : "Not passed"}</Badge>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
