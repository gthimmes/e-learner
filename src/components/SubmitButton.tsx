"use client";

import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
