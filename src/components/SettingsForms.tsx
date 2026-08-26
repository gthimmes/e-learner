"use client";

import { useActionState } from "react";
import { createApiKey, type ApiKeyState } from "@/lib/actions/apikeys";
import { createWebhook } from "@/lib/actions/webhooks";
import type { RosterState } from "@/lib/actions/roster";
import { WEBHOOK_EVENTS } from "@/lib/constants";
import { Alert, Field, Input, Label } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function ApiKeyForm() {
  const [state, formAction] = useActionState<ApiKeyState, FormData>(createApiKey, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.plaintext ? (
        <Alert tone="success">
          <div className="font-medium">Key “{state.name}” created. Copy it now — it won&apos;t be shown again.</div>
          <code className="mt-2 block select-all break-all rounded bg-white/60 p-2 text-xs dark:bg-black/30">{state.plaintext}</code>
        </Alert>
      ) : null}
      <Field>
        <Label htmlFor="key-name">Key name</Label>
        <Input id="key-name" name="name" placeholder="e.g. HR system sync" maxLength={60} required />
      </Field>
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Creating…">
          Create API key
        </SubmitButton>
      </div>
    </form>
  );
}

export function WebhookForm() {
  const [state, formAction] = useActionState<RosterState, FormData>(createWebhook, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? (
        <Alert tone="success">
          <span className="break-all">{state.message}</span>
        </Alert>
      ) : null}
      <Field>
        <Label htmlFor="hook-url">Endpoint URL</Label>
        <Input id="hook-url" name="url" type="url" placeholder="https://example.com/hooks/e-learner" required />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Events</legend>
        <div className="grid grid-cols-2 gap-1 text-sm">
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-2">
              <input type="checkbox" name="events" value={e} defaultChecked /> <code className="text-xs">{e}</code>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="secondary" pendingText="Adding…">
          Add webhook
        </SubmitButton>
      </div>
    </form>
  );
}
