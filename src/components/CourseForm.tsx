"use client";

import { useActionState, useState } from "react";
import { createCourse, updateCourse } from "@/lib/actions/courses";
import type { ActionState } from "@/lib/actions/auth";
import { slugify } from "@/lib/utils";
import { COURSE_LEVELS, COURSE_LEVEL_LABELS, CURRENCIES } from "@/lib/constants";
import { Alert, Field, Input, Label, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { MediaUpload } from "./MediaUpload";

type CourseValues = {
  id?: string;
  title?: string;
  slug?: string;
  summary?: string;
  description?: string;
  coverUrl?: string | null;
  sequential?: boolean;
  priceCents?: number;
  currency?: string;
  tags?: string;
  level?: string;
};

export function CourseForm({ mode, course }: { mode: "create" | "edit"; course?: CourseValues }) {
  const action = mode === "create" ? createCourse : updateCourse;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [title, setTitle] = useState(course?.title ?? "");
  const [slug, setSlug] = useState(course?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [coverUrl, setCoverUrl] = useState(course?.coverUrl ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {course?.id ? <input type="hidden" name="courseId" value={course.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Course saved.</Alert> : null}

      <Field>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="e.g. Introduction to Data Analysis"
        />
      </Field>

      <Field>
        <Label htmlFor="slug" hint="appears in the URL: /courses/your-slug">
          Slug
        </Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="introduction-to-data-analysis"
        />
      </Field>

      <Field>
        <Label htmlFor="summary" hint="one or two sentences shown in the catalog">
          Summary
        </Label>
        <Input id="summary" name="summary" maxLength={300} defaultValue={course?.summary ?? ""} />
      </Field>

      <Field>
        <Label htmlFor="description" hint="Markdown">
          Description
        </Label>
        <Textarea id="description" name="description" rows={10} defaultValue={course?.description ?? ""} placeholder={"## What you'll learn\n\n- ...\n\n## Who it's for\n\n..."} />
      </Field>

      <Field>
        <Label htmlFor="coverUrl">Cover image</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="coverUrl" name="coverUrl" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://… or upload" />
          <MediaUpload accept="image/*" onUploaded={(url) => setCoverUrl(url)} label="Upload image" />
        </div>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="mt-2 aspect-[21/9] w-full max-w-md rounded-lg object-cover" />
        ) : null}
      </Field>

      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <Field>
          <Label htmlFor="tags" hint="comma-separated, e.g. teaching, video, beginner">
            Tags
          </Label>
          <Input id="tags" name="tags" defaultValue={(course?.tags ?? "").split(",").filter(Boolean).join(", ")} placeholder="teaching, course-design" />
        </Field>
        <Field>
          <Label htmlFor="level">Level</Label>
          <select
            id="level"
            name="level"
            defaultValue={course?.level ?? "ALL"}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {COURSE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {COURSE_LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Field>
          <Label htmlFor="price" hint="0 = free">
            Price
          </Label>
          <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={((course?.priceCents ?? 0) / 100).toFixed(2)} />
        </Field>
        <Field>
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            name="currency"
            defaultValue={course?.currency ?? "usd"}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="sequential" defaultChecked={course?.sequential ?? false} className="mt-0.5" />
        <span>
          <span className="font-medium">Sequential</span>
          <span className="block text-zinc-500">Learners must complete lessons in order.</span>
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <SubmitButton pendingText={mode === "create" ? "Creating…" : "Saving…"}>{mode === "create" ? "Create course" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
