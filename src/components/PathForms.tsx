"use client";

import { useActionState, useState } from "react";
import { createPath, updatePath } from "@/lib/actions/paths";
import type { ActionState } from "@/lib/actions/auth";
import { slugify } from "@/lib/utils";
import { Alert, Field, Input, Label, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { MediaUpload } from "./MediaUpload";

type PathValues = { id?: string; title?: string; slug?: string; summary?: string; description?: string; coverUrl?: string | null };

export function PathForm({ mode, path }: { mode: "create" | "edit"; path?: PathValues }) {
  const action = mode === "create" ? createPath : updatePath;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [title, setTitle] = useState(path?.title ?? "");
  const [slug, setSlug] = useState(path?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [coverUrl, setCoverUrl] = useState(path?.coverUrl ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {path?.id ? <input type="hidden" name="pathId" value={path.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Path saved.</Alert> : null}
      <Field>
        <Label htmlFor="path-title">Title</Label>
        <Input
          id="path-title"
          name="title"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="e.g. Become an Online Instructor"
        />
      </Field>
      <Field>
        <Label htmlFor="path-slug" hint="appears in the URL: /paths/your-slug">
          Slug
        </Label>
        <Input
          id="path-slug"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        />
      </Field>
      <Field>
        <Label htmlFor="path-summary" hint="shown in the paths list">
          Summary
        </Label>
        <Input id="path-summary" name="summary" maxLength={300} defaultValue={path?.summary ?? ""} />
      </Field>
      <Field>
        <Label htmlFor="path-description" hint="Markdown">
          Description
        </Label>
        <Textarea id="path-description" name="description" rows={6} defaultValue={path?.description ?? ""} placeholder={"## Who this path is for\n\n..."} />
      </Field>
      <Field>
        <Label htmlFor="path-cover">Cover image</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="path-cover" name="coverUrl" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://… or upload" />
          <MediaUpload accept="image/*" onUploaded={(url) => setCoverUrl(url)} label="Upload image" />
        </div>
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText={mode === "create" ? "Creating…" : "Saving…"}>{mode === "create" ? "Create path" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
