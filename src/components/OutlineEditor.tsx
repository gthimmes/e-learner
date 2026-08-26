import Link from "next/link";
import { createLesson, createModule, deleteModule, moveLesson, moveModule, updateModule } from "@/lib/actions/courses";
import { LESSON_TYPES, LESSON_TYPE_ICONS, LESSON_TYPE_LABELS, type LessonType } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import { Button, Input, Select } from "./ui";

type Lesson = { id: string; title: string; type: string; durationMin: number };
type Module = { id: string; title: string; summary: string; lessons: Lesson[] };

const iconBtn = "rounded p-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-white";

/** Server-rendered module/lesson tree with reorder and create controls (AUTHOR-2, AUTHOR-6). */
export function OutlineEditor({ courseId, modules }: { courseId: string; modules: Module[] }) {
  return (
    <div className="space-y-4">
      {modules.map((m, mi) => (
        <section key={m.id} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Module {mi + 1}</span>
            <form action={updateModule} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="moduleId" value={m.id} />
              <Input name="title" defaultValue={m.title} aria-label="Module title" className="min-w-40 flex-1" />
              <Input name="summary" defaultValue={m.summary} placeholder="Short summary (optional)" aria-label="Module summary" className="min-w-40 flex-[2]" />
              <Button type="submit" variant="secondary" size="sm">
                Save
              </Button>
            </form>
            <div className="flex items-center gap-1">
              <form action={moveModule}>
                <input type="hidden" name="moduleId" value={m.id} />
                <input type="hidden" name="dir" value="up" />
                <button className={iconBtn} disabled={mi === 0} aria-label="Move module up" title="Move up">
                  ▲
                </button>
              </form>
              <form action={moveModule}>
                <input type="hidden" name="moduleId" value={m.id} />
                <input type="hidden" name="dir" value="down" />
                <button className={iconBtn} disabled={mi === modules.length - 1} aria-label="Move module down" title="Move down">
                  ▼
                </button>
              </form>
              <form action={deleteModule}>
                <input type="hidden" name="moduleId" value={m.id} />
                <button className={`${iconBtn} hover:text-red-600`} aria-label="Delete module" title={m.lessons.length ? `Delete module and its ${m.lessons.length} lesson(s)` : "Delete module"}>
                  ✕
                </button>
              </form>
            </div>
          </div>

          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {m.lessons.map((l, li) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-6 text-center" aria-hidden>
                  {LESSON_TYPE_ICONS[l.type as LessonType]}
                </span>
                <Link href={`/author/${courseId}/lessons/${l.id}`} className="flex-1 font-medium hover:text-indigo-600 hover:underline">
                  {l.title}
                </Link>
                <span className="hidden text-xs text-zinc-500 sm:inline">
                  {LESSON_TYPE_LABELS[l.type as LessonType]} · {formatDuration(l.durationMin)}
                </span>
                <div className="flex items-center gap-1">
                  <form action={moveLesson}>
                    <input type="hidden" name="lessonId" value={l.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button className={iconBtn} disabled={li === 0} aria-label="Move lesson up">
                      ▲
                    </button>
                  </form>
                  <form action={moveLesson}>
                    <input type="hidden" name="lessonId" value={l.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button className={iconBtn} disabled={li === m.lessons.length - 1} aria-label="Move lesson down">
                      ▼
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>

          <form action={createLesson} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
            <input type="hidden" name="moduleId" value={m.id} />
            <Input name="title" placeholder="New lesson title" aria-label="New lesson title" className="min-w-40 flex-1" />
            <Select name="type" defaultValue="TEXT" aria-label="Lesson type">
              {LESSON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LESSON_TYPE_ICONS[t]} {LESSON_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm">
              Add lesson
            </Button>
          </form>
        </section>
      ))}

      <form action={createModule} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <input type="hidden" name="courseId" value={courseId} />
        <Input name="title" placeholder="New module title" aria-label="New module title" className="min-w-40 flex-1" />
        <Button type="submit" variant="secondary">
          Add module
        </Button>
      </form>
    </div>
  );
}
