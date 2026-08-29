"use client";

import { useActionState, useState, useTransition } from "react";
import { askTutor, draftLesson, generateCourse } from "@/lib/actions/ai";
import type { ActionState } from "@/lib/actions/auth";
import { Alert, Button, Field, Input, Label, Select, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";

/** "Draft with AI" panel on the new-course page (v2.0). */
export function AiCourseForm({ provider }: { provider: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(generateCourse, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field>
        <Label htmlFor="ai-topic">What should the course teach?</Label>
        <Textarea id="ai-topic" name="topic" rows={3} required minLength={4} placeholder="e.g. Practical SQL for analysts: joins, aggregation and window functions" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <Label htmlFor="ai-audience">Audience</Label>
          <Input id="ai-audience" name="audience" placeholder="beginners" />
        </Field>
        <Field>
          <Label htmlFor="ai-modules">Modules</Label>
          <Select id="ai-modules" name="modules" defaultValue="3" className="w-full">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="ai-lessons">Lessons / module</Label>
          <Select id="ai-lessons" name="lessonsPerModule" defaultValue="3" className="w-full">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Creates a <strong>draft</strong> you can edit — nothing is published. Model: <code>{provider}</code>.
        </p>
        <SubmitButton pendingText="Drafting… (up to a minute)">✨ Draft course</SubmitButton>
      </div>
    </form>
  );
}

/** Inserts a generated Markdown body into the lesson editor. */
export function AiDraftButton({ lessonId, getTitle, onDraft }: { lessonId: string; getTitle: () => string; onDraft: (markdown: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await draftLesson({ lessonId, title: getTitle() });
            if (r.error) setError(r.error);
            else if (r.body) onDraft(r.body);
          })
        }
      >
        {pending ? "Drafting…" : "✨ Draft with AI"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

type Msg = { role: "user" | "assistant"; text: string };

/** Learner-side tutor, grounded in the current lesson. */
export function AiTutor({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send() {
    const q = question.trim();
    if (!q || pending) return;
    setQuestion("");
    setError(null);
    const next = [...history, { role: "user" as const, text: q }];
    setHistory(next);
    start(async () => {
      const r = await askTutor({ lessonId, question: q, history });
      if (r.error) setError(r.error);
      else setHistory([...next, { role: "assistant", text: r.answer ?? "" }]);
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40 dark:border-indigo-900 dark:bg-indigo-950/20" aria-label="AI tutor">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium" aria-expanded={open}>
        <span>✨ Ask the tutor about “{lessonTitle}”</span>
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Open"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-indigo-100 px-4 py-3 dark:border-indigo-900">
          <p className="text-xs text-zinc-500">Answers come only from this lesson. The tutor won&apos;t hand you quiz answers — it explains the idea instead.</p>
          <ul className="space-y-2" aria-live="polite">
            {history.map((m, i) => (
              <li key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-900" : "mr-8 rounded-lg bg-indigo-100 px-3 py-2 text-sm dark:bg-indigo-900/40"}>
                <span className="mr-1 text-xs font-semibold text-zinc-500">{m.role === "user" ? "You" : "Tutor"}</span> {m.text}
              </li>
            ))}
            {pending ? <li className="mr-8 rounded-lg bg-indigo-100 px-3 py-2 text-sm text-zinc-500 dark:bg-indigo-900/40">Thinking…</li> : null}
          </ul>
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="e.g. Why does the pass mark matter?"
              aria-label="Your question"
            />
            <Button type="button" onClick={send} disabled={pending || !question.trim()}>
              Ask
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
