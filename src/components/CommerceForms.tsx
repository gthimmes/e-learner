"use client";

import { useActionState } from "react";
import { createCoupon, startCheckout, type CheckoutState } from "@/lib/actions/commerce";
import type { RosterState } from "@/lib/actions/roster";
import { Alert, Field, Input, Label } from "./ui";
import { SubmitButton } from "./SubmitButton";

/** Learner-facing purchase form with an optional coupon (v1.0). */
export function BuyForm({ courseId, priceLabel, signedIn }: { courseId: string; priceLabel: string; signedIn: boolean }) {
  const [state, formAction] = useActionState<CheckoutState, FormData>(startCheckout, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="text-sm text-zinc-500">One-time purchase · lifetime access</div>
      <div className="text-2xl font-semibold">{priceLabel}</div>
      {signedIn ? (
        <Field>
          <Label htmlFor="coupon">Coupon code</Label>
          <Input id="coupon" name="coupon" placeholder="Optional" autoComplete="off" className="uppercase" />
        </Field>
      ) : null}
      <SubmitButton className="w-full" pendingText="Redirecting…">
        {signedIn ? `Buy for ${priceLabel}` : "Sign in to buy"}
      </SubmitButton>
    </form>
  );
}

export function CouponForm({ courseId }: { courseId: string }) {
  const [state, formAction] = useActionState<RosterState, FormData>(createCoupon, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" placeholder="LAUNCH50" required className="uppercase" />
        </Field>
        <Field>
          <Label htmlFor="percentOff">% off</Label>
          <Input id="percentOff" name="percentOff" type="number" min={1} max={100} defaultValue={50} required />
        </Field>
        <Field>
          <Label htmlFor="maxUses" hint="0 = unlimited">
            Max uses
          </Label>
          <Input id="maxUses" name="maxUses" type="number" min={0} defaultValue={0} />
        </Field>
        <Field>
          <Label htmlFor="expiresAt">Expires</Label>
          <Input id="expiresAt" name="expiresAt" type="date" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="secondary" pendingText="Creating…">
          Create coupon
        </SubmitButton>
      </div>
    </form>
  );
}
