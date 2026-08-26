"use client";

import { useActionState } from "react";
import { enrollByEmail, type RosterState } from "@/lib/actions/roster";
import { Alert, Label, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";

/** Instructor form: enroll existing users by email (LEARN-11). */
export function EnrollForm({ courseId }: { courseId: string }) {
  const [state, formAction] = useActionState<RosterState, FormData>(enrollByEmail, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div>
        <Label htmlFor="emails" hint="comma or newline separated; users must already have an account">
          Enroll learners by email
        </Label>
        <Textarea id="emails" name="emails" rows={3} placeholder={"alice@example.com\nbob@example.com"} />
      </div>
      <div className="flex justify-end">
        <SubmitButton variant="secondary" size="sm" pendingText="Enrolling…">
          Enroll
        </SubmitButton>
      </div>
    </form>
  );
}
