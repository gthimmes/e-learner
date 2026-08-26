import { getQuizStats } from "@/lib/quiz";
import { pct } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

/** Instructor analytics panel for a quiz lesson (ADMIN-4). */
export async function QuizStats({ lessonId }: { lessonId: string }) {
  const s = await getQuizStats(lessonId);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Attempts" value={s.attemptCount} />
        <Stat label="Learners" value={s.learnerCount} />
        <Stat label="Pass rate" value={s.learnerCount ? `${pct(s.passedCount, s.learnerCount)}%` : "—"} />
        <Stat label="Avg score" value={s.attemptCount ? `${s.avgScore}%` : "—"} />
      </div>
      {s.perQuestion.some((q) => q.answered > 0) ? (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Hardest questions</div>
          <ol className="space-y-1 text-sm">
            {s.perQuestion
              .filter((q) => q.answered > 0)
              .slice(0, 5)
              .map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{q.prompt || "(untitled)"}</span>
                  <span className={`shrink-0 text-xs ${(q.correctPct ?? 100) < 50 ? "text-red-600" : "text-zinc-500"}`}>{q.correctPct}% correct</span>
                </li>
              ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
