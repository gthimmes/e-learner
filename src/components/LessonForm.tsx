"use client";

import { useActionState, useState } from "react";
import { updateLesson } from "@/lib/actions/courses";
import type { ActionState } from "@/lib/actions/auth";
import { LESSON_TYPES, LESSON_TYPE_ICONS, LESSON_TYPE_LABELS, type LessonType } from "@/lib/constants";
import { Alert, Field, Input, Label, Select, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { MediaUpload } from "./MediaUpload";

type LessonValues = {
  id: string;
  title: string;
  type: string;
  body: string;
  mediaUrl: string | null;
  mediaCaption: string;
  durationMin: number;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  showAnswers: boolean;
  timeLimitMin: number;
  drawCount: number;
};

const ACCEPT: Partial<Record<LessonType, string>> = {
  VIDEO: "video/*",
  AUDIO: "audio/*",
  IMAGE: "image/*",
  FILE: ".pdf,.txt,.md,.zip,.docx,.xlsx,.pptx,application/pdf",
};

const MEDIA_HINT: Partial<Record<LessonType, string>> = {
  VIDEO: "Paste a YouTube or Vimeo link, or upload an MP4 / WebM.",
  AUDIO: "Upload an MP3, WAV, OGG or M4A, or paste a direct audio URL.",
  IMAGE: "Upload an image or paste an image URL.",
  FILE: "Upload a PDF, document or archive for learners to download.",
};

export function LessonForm({ lesson }: { lesson: LessonValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateLesson, {});
  const [type, setType] = useState<LessonType>(lesson.type as LessonType);
  const [mediaUrl, setMediaUrl] = useState(lesson.mediaUrl ?? "");
  const [body, setBody] = useState(lesson.body);
  const hasMedia = type !== "TEXT" && type !== "QUIZ";

  function insertAtCursor(text: string) {
    setBody((b) => (b ? `${b}\n\n${text}` : text));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lessonId" value={lesson.id} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Lesson saved.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_200px_120px]">
        <Field>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={lesson.title} />
        </Field>
        <Field>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as LessonType)} className="w-full">
            {LESSON_TYPES.map((t) => (
              <option key={t} value={t}>
                {LESSON_TYPE_ICONS[t]} {LESSON_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="durationMin">Minutes</Label>
          <Input id="durationMin" name="durationMin" type="number" min={0} max={1440} defaultValue={lesson.durationMin} />
        </Field>
      </div>

      {hasMedia ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <Field>
            <Label htmlFor="mediaUrl" hint={MEDIA_HINT[type]}>
              Media
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="mediaUrl" name="mediaUrl" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={type === "VIDEO" ? "https://www.youtube.com/watch?v=…" : "https://…"} />
              <MediaUpload accept={ACCEPT[type]} onUploaded={(url) => setMediaUrl(url)} label={`Upload ${LESSON_TYPE_LABELS[type].toLowerCase()}`} />
            </div>
          </Field>
          <Field>
            <Label htmlFor="mediaCaption" hint="shown under the media; doubles as alt text for images">
              Caption
            </Label>
            <Input id="mediaCaption" name="mediaCaption" defaultValue={lesson.mediaCaption} />
          </Field>
        </div>
      ) : (
        <input type="hidden" name="mediaUrl" value="" />
      )}

      {type === "QUIZ" ? (
        <div className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950/40">
          <Field>
            <Label htmlFor="passingScore" hint="%">
              Passing score
            </Label>
            <Input id="passingScore" name="passingScore" type="number" min={0} max={100} defaultValue={lesson.passingScore} />
          </Field>
          <Field>
            <Label htmlFor="maxAttempts" hint="0 = unlimited">
              Max attempts
            </Label>
            <Input id="maxAttempts" name="maxAttempts" type="number" min={0} max={100} defaultValue={lesson.maxAttempts} />
          </Field>
          <Field>
            <Label htmlFor="timeLimitMin" hint="minutes, 0 = untimed">
              Time limit
            </Label>
            <Input id="timeLimitMin" name="timeLimitMin" type="number" min={0} max={1440} defaultValue={lesson.timeLimitMin} />
          </Field>
          <Field>
            <Label htmlFor="drawCount" hint="0 = all questions">
              Questions per attempt
            </Label>
            <Input id="drawCount" name="drawCount" type="number" min={0} max={500} defaultValue={lesson.drawCount} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="shuffleQuestions" defaultChecked={lesson.shuffleQuestions} /> Shuffle questions
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showAnswers" defaultChecked={lesson.showAnswers} /> Show correct answers after submitting
          </label>
          <p className="text-xs text-zinc-500 sm:col-span-2">Questions are edited below the lesson once saved. Timed quizzes and question banks show a Start button and fix the clock and the drawn questions per attempt; essay questions wait in the Grading queue.</p>
        </div>
      ) : null}

      <Field>
        <div className="flex items-center justify-between">
          <Label htmlFor="body" hint="Markdown · GFM">
            {type === "QUIZ" ? "Instructions" : "Content"}
          </Label>
          <div className="flex gap-1 text-xs">
            <button type="button" className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => insertAtCursor("## Heading\n\nText…")}>
              + Heading
            </button>
            <button type="button" className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => insertAtCursor("| Column | Column |\n| --- | --- |\n| Cell | Cell |")}>
              + Table
            </button>
            <button type="button" className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => insertAtCursor("```\ncode\n```")}>
              + Code
            </button>
            <MediaUpload accept="image/*" label="+ Inline image" onUploaded={(url) => insertAtCursor(`![](${url})`)} />
          </div>
        </div>
        <Textarea id="body" name="body" rows={18} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-[13px] leading-relaxed" placeholder="Write the lesson in Markdown…" />
      </Field>

      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save lesson</SubmitButton>
      </div>
    </form>
  );
}
