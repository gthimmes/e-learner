import { resolveVideoEmbed } from "@/lib/utils";
import { ResumableMedia } from "./ResumableMedia";

type Props = { type: string; url: string | null | undefined; caption?: string; title?: string };

/** Renders the media block for a lesson by type (AUTHOR-3). */
export function MediaPlayer({ type, url, caption, title }: Props) {
  if (!url) return null;
  let inner: React.ReactNode = null;

  if (type === "VIDEO") {
    const embed = resolveVideoEmbed(url);
    if (embed?.kind === "youtube" || embed?.kind === "vimeo") {
      inner = (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            src={embed.src}
            title={title ?? "Video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      );
    } else if (embed) {
      inner = <ResumableMedia kind="video" src={embed.src} className="aspect-video w-full rounded-xl bg-black" />;
    }
  } else if (type === "AUDIO") {
    inner = (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <ResumableMedia kind="audio" src={url} className="w-full" />
      </div>
    );
  } else if (type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    inner = <img src={url} alt={caption || title || ""} className="max-h-[70vh] w-auto max-w-full rounded-xl" />;
  } else if (type === "FILE") {
    const name = url.split("/").pop() ?? "file";
    inner = (
      <a
        href={url}
        download
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        📎 Download {name}
      </a>
    );
  }

  if (!inner) return null;
  return (
    <figure className="my-6">
      {inner}
      {caption ? <figcaption className="mt-2 text-sm text-zinc-500">{caption}</figcaption> : null}
    </figure>
  );
}
