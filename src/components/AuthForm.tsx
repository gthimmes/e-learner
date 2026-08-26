"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, register, type ActionState } from "@/lib/actions/auth";
import { Alert, Field, Input, Label } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const action = mode === "login" ? login : register;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      {mode === "register" ? (
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
      ) : null}
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "register" ? 8 : undefined}
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingText={mode === "login" ? "Signing in…" : "Creating account…"}>
        {mode === "login" ? "Sign in" : "Create account"}
      </SubmitButton>
      <p className="text-center text-sm text-zinc-500">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-indigo-600 hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-indigo-600 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
