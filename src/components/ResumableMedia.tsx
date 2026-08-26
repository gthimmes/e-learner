"use client";

import { useEffect, useRef } from "react";

/**
 * <video>/<audio> that remembers playback position per media URL in localStorage (LEARN-8).
 * Position is cleared once the learner reaches the end.
 */
export function ResumableMedia({ kind, src, className }: { kind: "video" | "audio"; src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const key = `el:pos:${src}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      try {
        const saved = Number(localStorage.getItem(key));
        if (saved > 5 && saved < el.duration - 5) el.currentTime = saved;
      } catch {}
    };
    let last = 0;
    const save = () => {
      const now = Date.now();
      if (now - last < 2000) return;
      last = now;
      try {
        localStorage.setItem(key, String(Math.floor(el.currentTime)));
      } catch {}
    };
    const clear = () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    };
    el.addEventListener("loadedmetadata", restore);
    el.addEventListener("timeupdate", save);
    el.addEventListener("ended", clear);
    if (el.readyState >= 1) restore();
    return () => {
      el.removeEventListener("loadedmetadata", restore);
      el.removeEventListener("timeupdate", save);
      el.removeEventListener("ended", clear);
    };
  }, [key]);

  if (kind === "video") {
    return (
      <video ref={ref} controls preload="metadata" className={className} src={src}>
        Your browser does not support HTML5 video.
      </video>
    );
  }
  return (
    <audio ref={ref} controls preload="metadata" className={className} src={src}>
      Your browser does not support HTML5 audio.
    </audio>
  );
}
