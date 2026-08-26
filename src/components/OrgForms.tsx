"use client";

import { useActionState } from "react";
import { addMembers, createOrganization } from "@/lib/actions/org";
import { addCoAuthor } from "@/lib/actions/authors";
import type { RosterState } from "@/lib/actions/roster";
import { Alert, Field, Input, Label, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function CreateOrgForm() {
  const [state, formAction] = useActionState<RosterState, FormData>(createOrganization, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field>
        <Label htmlFor="org-name">Organization name</Label>
        <Input id="org-name" name="name" required placeholder="Acme Corp" />
      </Field>
      <Field>
        <Label htmlFor="org-slug" hint="optional; generated from the name">
          Slug
        </Label>
        <Input id="org-slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="acme" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Creating…">Create organization</SubmitButton>
      </div>
    </form>
  );
}

export function AddMembersForm({ orgId }: { orgId: string }) {
  const [state, formAction] = useActionState<RosterState, FormData>(addMembers, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field>
        <Label htmlFor="member-emails" hint="comma or newline separated; users must already have an account">
          Add members by email
        </Label>
        <Textarea id="member-emails" name="emails" rows={3} placeholder={"alice@acme.com\nbob@acme.com"} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton variant="secondary" size="sm" pendingText="Adding…">
          Add members
        </SubmitButton>
      </div>
    </form>
  );
}

export function CoAuthorForm({ courseId }: { courseId: string }) {
  const [state, formAction] = useActionState<RosterState, FormData>(addCoAuthor, {});
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="courseId" value={courseId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="flex gap-2">
        <Input name="email" type="email" required placeholder="colleague@example.com" aria-label="Co-author email" />
        <SubmitButton variant="secondary" size="sm" pendingText="…">
          Add
        </SubmitButton>
      </div>
    </form>
  );
}
