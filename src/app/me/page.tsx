import { requireUser } from "@/lib/auth";
import { BADGES, getProfile, type BadgeKey } from "@/lib/engage";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatDate, initials } from "@/lib/utils";

export const metadata = { title: "Your profile" };

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="text-center">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-zinc-500">{label}</div>
      {hint ? <div className="text-xs text-zinc-400">{hint}</div> : null}
    </Card>
  );
}

export default async function ProfilePage() {
  const session = await requireUser("/me");
  const p = await getProfile(session.id);
  if (!p) return null;
  const earned = new Map(p.badges.map((b) => [b.key + b.courseId, b]));
  const globalKeys = (Object.keys(BADGES) as BadgeKey[]).filter((k) => k !== "COURSE_COMPLETE" && k !== "PATH_COMPLETE");
  const scoped = p.badges.filter((b) => b.key === "COURSE_COMPLETE" || b.key === "PATH_COMPLETE");
  const maxLessons = Math.max(1, ...p.activity.map((a) => a.lessons));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-indigo-600 text-lg font-semibold text-white">{initials(p.user.name)}</span>
            {p.user.name}
          </span>
        }
        subtitle={
          <>
            {p.user.email} · {p.user.role.charAt(0) + p.user.role.slice(1).toLowerCase()}
            {p.user.organization ? ` · ${p.user.organization.name}` : ""} · joined {formatDate(p.user.createdAt)}
          </>
        }
        actions={
          <LinkButton href="/learn" variant="secondary">
            My Learning
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="day streak" value={<>🔥 {p.streak.current}</>} hint={p.streak.activeToday ? "active today" : p.streak.current ? "learn today to keep it" : `longest ${p.streak.longest}`} />
        <Stat label="points" value={p.user.points} />
        <Stat label="courses completed" value={`${p.completedCount} / ${p.enrolledCount}`} />
        <Stat label="badges" value={p.badges.length} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Last 14 days</h2>
        <Card>
          <div className="flex items-end gap-1" aria-label="Activity by day">
            {p.activity.map((a) => {
              const active = a.lessons > 0 || a.visits > 0;
              const h = a.lessons > 0 ? 24 + Math.round((a.lessons / maxLessons) * 40) : active ? 16 : 6;
              return (
                <div key={a.day} className="flex flex-1 flex-col items-center gap-1" title={`${a.day}: ${a.lessons} lesson(s) completed, ${a.visits} visit(s)`}>
                  <div className={`w-full rounded-sm ${a.lessons > 0 ? "bg-indigo-600" : active ? "bg-indigo-300" : "bg-zinc-200 dark:bg-zinc-800"}`} style={{ height: h }} />
                  <span className="text-[10px] text-zinc-400">{a.day.slice(8)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">Dark = lessons completed · light = visited · streaks count any activity day (UTC).</p>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Badges</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {globalKeys.map((k) => {
            const b = BADGES[k];
            const e = earned.get(k + "");
            return (
              <div key={k} className={`flex items-center gap-3 rounded-xl border p-4 ${e ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-dashed border-zinc-300 opacity-70 dark:border-zinc-700"}`}>
                <span className={`text-3xl ${e ? "" : "grayscale"}`} aria-hidden>
                  {b.icon}
                </span>
                <div>
                  <div className="font-medium">{b.label}</div>
                  <div className="text-xs text-zinc-500">{b.description}</div>
                  <div className="mt-1 text-xs">{e ? <Badge tone="success">Earned {formatDate(e.earnedAt)}</Badge> : <Badge>Locked</Badge>}</div>
                </div>
              </div>
            );
          })}
          {scoped.map((b) => {
            const def = BADGES[b.key as BadgeKey];
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <span className="text-3xl" aria-hidden>
                  {def.icon}
                </span>
                <div>
                  <div className="font-medium">{def.label}</div>
                  <div className="text-xs text-zinc-500">{b.scopeLabel || def.description}</div>
                  <div className="mt-1 text-xs">
                    <Badge tone="success">Earned {formatDate(b.earnedAt)}</Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
