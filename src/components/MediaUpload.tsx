"use client";

import { useRef, useState } from "react";
import { Button } from "./ui";

/** Uploads a file to /api/upload and hands back its URL (AUTHOR-5). */
export function MediaUpload({
  accept,
  label = "Upload",
  onUploaded,
}: {
  accept?: string;
  label?: string;
  onUploaded: (url: string, meta: { contentType: string; size: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
      onUploaded(json.url, { contentType: json.contentType, size: json.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
