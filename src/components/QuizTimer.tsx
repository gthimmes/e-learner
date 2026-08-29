"use client";

import { useEffect, useRef, useState } from "react";

/** Countdown for a timed attempt; submits `formId` once when it reaches zero (QUIZ-8). */
export function QuizTimer({ deadline, formId }: { deadline: string; formId: string }) {
  const end = new Date(deadline).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, end - Date.now());
      setLeft(remaining);
      if (remaining === 0 && !fired.current) {
        fired.current = true;
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [end, formId]);

  const totalSec = Math.ceil(left / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const urgent = left <= 60_000;
  return (
    <div
      role="timer"
      aria-live={urgent ? "assertive" : "polite"}
      aria-label="Time remaining"
      className={`sticky top-16 z-10 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-sm font-semibold ${
        urgent ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" : "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      }`}
    >
      ⏱ {m}:{s.toString().padStart(2, "0")}
      {left === 0 ? <span className="font-sans font-normal">— submitting…</span> : null}
    </div>
  );
}
