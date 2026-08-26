import Link from "next/link";
import { formatDuration } from "@/lib/utils";

type Props = {
  href: string;
  title: string;
  summary: string;
  coverUrl?: string | null;
  instructor?: string;
  lessonCount: number;
  durationMin: number;
  footer?: React.ReactNode;
};

export function CourseCard({ href, title, summary, coverUrl, instructor, lessonCount, durationMin, footer }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="aspect-[16/9] w-full bg-gradient-to-br from-indigo-500 to-violet-600">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-snug group-hover:text-indigo-600">{title}</h3>
        {summary ? <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{summary}</p> : null}
        <div className="mt-auto pt-3 text-xs text-zinc-500">
          {instructor ? <span>{instructor} · </span> : null}
          {lessonCount} lesson{lessonCount === 1 ? "" : "s"} · {formatDuration(durationMin)}
        </div>
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </Link>
  );
}
