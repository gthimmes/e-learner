"use client";

import { useEffect } from "react";
import { touchLesson } from "@/lib/actions/learning";

/** Records the lesson being viewed so "Resume" returns here (LEARN-6). */
export function TrackLesson({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    touchLesson(lessonId).catch(() => {});
  }, [lessonId]);
  return null;
}
