"use client";

import { useActionState } from "react";
import { enrollByEmail, type RosterState } from "@/lib/actions/roster";
import { Alert, Label, Select, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";

type Cohort = { id: string; name: string };

/** Instructor form: enroll existing users by email, optionally into a cohort (LEARN-11, LEARN-12). */
export function EnrollForm({ courseId, cohorts }: { courseId: string; cohorts: Cohort[] }) {
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
      {cohorts.length ? (
        <div>
          <Label htmlFor="cohortId">Cohort</Label>
          <Select id="cohortId" name="cohortId" defaultValue="" className="w-full">
            <option value="">No cohort (self-paced)</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton variant="secondary" size="sm" pendingText="Enrolling…">
          Enroll
        </SubmitButton>
      </div>
    </form>
  );
}
