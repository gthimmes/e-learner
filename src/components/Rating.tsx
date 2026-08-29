"use client";

import { useActionState, useState } from "react";
import { submitReview } from "@/lib/actions/reviews";
import type { ActionState } from "@/lib/actions/auth";
import { Alert, Field, Label, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";
import { cn } from "@/lib/utils";

/** Read-only star display, e.g. ★★★★☆ 4.3 (12). */
export function Stars({ value, count, size = "sm" }: { value: number; count?: number; size?: "sm" | "lg" }) {
  const rounded = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-1", size === "lg" ? "text-base" : "text-xs")} aria-label={count ? `${value} out of 5 from ${count} reviews` : "No reviews yet"}>
      <span className="tracking-tight text-amber-500" aria-hidden>
        {"★".repeat(rounded)}
        <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - rounded)}</span>
      </span>
      {count ? (
        <span className="text-zinc-500">
          {value.toFixed(1)} ({count})
        </span>
      ) : (
        <span className="text-zinc-500">No reviews yet</span>
      )}
    </span>
  );
}

export function ReviewForm({ courseId, existing }: { courseId: string; existing?: { rating: number; body: string } | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(submitReview, {});
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="rating" value={rating || ""} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">Thanks — your review is live.</Alert> : null}
      <div>
        <Label>Your rating</Label>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className={cn("text-2xl leading-none transition", (hover || rating) >= n ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600")}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <Field>
        <Label htmlFor="review-body" hint="optional">
          What did you think?
        </Label>
        <Textarea id="review-body" name="body" rows={3} maxLength={2000} defaultValue={existing?.body ?? ""} placeholder="What worked well? What would you change?" />
      </Field>
      <SubmitButton size="sm" pendingText="Posting…">
        {existing ? "Update review" : "Post review"}
      </SubmitButton>
    </form>
  );
}
