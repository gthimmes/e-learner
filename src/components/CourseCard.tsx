import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { COURSE_LEVEL_LABELS, type CourseLevel } from "@/lib/constants";
import { Stars } from "./Rating";

type Props = {
  href: string;
  title: string;
  summary: string;
  coverUrl?: string | null;
  instructor?: string;
  lessonCount: number;
  durationMin: number;
  rating?: { avg: number; count: number };
  tags?: string[];
  level?: string;
  featured?: boolean;
  priceLabel?: string;
  footer?: React.ReactNode;
};

export function CourseCard({ href, title, summary, coverUrl, instructor, lessonCount, durationMin, rating, tags, level, featured, priceLabel, footer }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-indigo-500 to-violet-600">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {featured ? <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950">Featured</span> : null}
        {priceLabel ? <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-zinc-900">{priceLabel}</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-snug group-hover:text-indigo-600">{title}</h3>
        {summary ? <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{summary}</p> : null}
        {rating ? (
          <div className="mt-2">
            <Stars value={rating.avg} count={rating.count} />
          </div>
        ) : null}
        <div className="mt-auto pt-3 text-xs text-zinc-500">
          {instructor ? <span>{instructor} · </span> : null}
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"} · {formatDuration(durationMin)}
          {level && level !== "ALL" ? <span> · {COURSE_LEVEL_LABELS[level as CourseLevel]}</span> : null}
        </div>
        {tags && tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 4).map((t) => (
              <span key={t} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                #{t}
              </span>
            ))}
          </div>
        ) : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </Link>
  );
}
