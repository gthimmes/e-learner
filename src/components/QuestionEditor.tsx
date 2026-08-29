import { addChoice, addQuestion, deleteChoice, deleteQuestion, moveQuestion, updateQuestion } from "@/lib/actions/quiz";
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/constants";
import { Button, Input, Label, Select, Textarea } from "./ui";

type Choice = { id: string; text: string; isCorrect: boolean };
type Question = { id: string; type: string; prompt: string; explanation: string; answerText: string; rubric: string; points: number; choices: Choice[] };

const iconBtn = "inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-white";

/** Server-rendered question bank editor for a QUIZ lesson (AUTHOR-10, QUIZ-1). */
export function QuestionEditor({ lessonId, questions }: { lessonId: string; questions: Question[] }) {
  return (
    <div className="space-y-4">
      {questions.length === 0 ? <p className="text-sm text-zinc-500">No questions yet. Add one below.</p> : null}

      {questions.map((q, i) => {
        const type = q.type as QuestionType;
        const isChoice = type === "SINGLE" || type === "MULTI" || type === "TRUE_FALSE";
        return (
          <form key={q.id} id={`q-${q.id}`} action={updateQuestion} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <input type="hidden" name="questionId" value={q.id} />
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Q{i + 1} · {QUESTION_TYPE_LABELS[type]}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button formAction={moveQuestion.bind(null, "up")} className={iconBtn} disabled={i === 0} aria-label="Move question up">
                  ▲
                </button>
                <button formAction={moveQuestion.bind(null, "down")} className={iconBtn} disabled={i === questions.length - 1} aria-label="Move question down">
                  ▼
                </button>
                <button formAction={deleteQuestion} className={`${iconBtn} hover:text-red-600`} aria-label="Delete question">
                  ✕
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
              <div>
                <Label htmlFor={`prompt-${q.id}`} hint="Markdown">
                  Question
                </Label>
                <Textarea id={`prompt-${q.id}`} name="prompt" rows={2} defaultValue={q.prompt} placeholder="What is…?" required />
              </div>
              <div>
                <Label htmlFor={`points-${q.id}`}>Points</Label>
                <Input id={`points-${q.id}`} name="points" type="number" min={1} max={100} defaultValue={q.points} />
              </div>
            </div>

            {isChoice ? (
              <fieldset className="mt-3">
                <legend className="mb-1 text-sm font-medium">
                  Choices <span className="font-normal text-zinc-500">— mark the correct {type === "MULTI" ? "answers" : "answer"}</span>
                </legend>
                <ul className="space-y-2">
                  {q.choices.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      {type === "MULTI" ? (
                        <input type="checkbox" name={`correct_${c.id}`} defaultChecked={c.isCorrect} aria-label="Correct" />
                      ) : (
                        <input type="radio" name="correct" value={c.id} defaultChecked={c.isCorrect} aria-label="Correct" />
                      )}
                      <Input name={`choice_${c.id}`} defaultValue={c.text} placeholder="Choice text" readOnly={type === "TRUE_FALSE"} />
                      {type !== "TRUE_FALSE" ? (
                        <button formAction={deleteChoice.bind(null, c.id)} className={`${iconBtn} hover:text-red-600`} disabled={q.choices.length <= 2} aria-label="Remove choice">
                          ✕
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {type !== "TRUE_FALSE" ? (
                  <button formAction={addChoice} className="mt-2 text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
                    + Add choice
                  </button>
                ) : null}
              </fieldset>
            ) : type === "ESSAY" ? (
              <div className="mt-3">
                <Label htmlFor={`rubric-${q.id}`} hint="grading notes — only instructors see this; points above are the maximum">
                  Rubric
                </Label>
                <Textarea id={`rubric-${q.id}`} name="rubric" rows={2} defaultValue={q.rubric} placeholder="Full marks if the answer covers…" />
              </div>
            ) : (
              <div className="mt-3">
                <Label htmlFor={`answer-${q.id}`} hint="accepted answers, one per line; case-insensitive">
                  Correct answer(s)
                </Label>
                <Textarea id={`answer-${q.id}`} name="answerText" rows={2} defaultValue={q.answerText} placeholder={"Paris\nparis, france"} />
              </div>
            )}

            <div className="mt-3">
              <Label htmlFor={`expl-${q.id}`} hint="shown after answering (optional)">
                Explanation
              </Label>
              <Input id={`expl-${q.id}`} name="explanation" defaultValue={q.explanation} />
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" variant="secondary">
                Save question
              </Button>
            </div>
          </form>
        );
      })}

      <form action={addQuestion} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <input type="hidden" name="lessonId" value={lessonId} />
        <Select name="type" defaultValue="SINGLE" aria-label="Question type">
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Add question
        </Button>
      </form>
    </div>
  );
}
