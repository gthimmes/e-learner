"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/actions/password";
import type { ActionState } from "@/lib/actions/auth";
import { Alert, Field, Input, Label } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function ForgotForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(requestPasswordReset, {});
  if (state.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="success">If an account exists for that email, a reset link is on its way. It expires in 60 minutes.</Alert>
        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(resetPassword, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <Alert>
          {state.error}{" "}
          <Link href="/forgot" className="underline">
            Request a new link
          </Link>
        </Alert>
      ) : null}
      <Field>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
