import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayKey, shiftDay } from "@/lib/streak";
import { formatMoney } from "@/lib/payments";
import { Card, PageHeader } from "@/components/ui";
import { pct } from "@/lib/utils";

export const metadata = { title: "Analytics" };

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </Card>
  );
}

/** Tiny dependency-free bar chart (server-rendered SVG). */
function Bars({ series, color = "#4f46e5", label }: { series: Array<{ day: string; value: number }>; color?: string; label: string }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const w = 600;
  const h = 120;
  const bw = w / series.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full" role="img" aria-label={label}>
      {series.map((s, i) => {
        const bh = Math.round((s.value / max) * h);
        return (
          <g key={s.day}>
            <rect x={i * bw + 1} y={h - bh} width={Math.max(1, bw - 2)} height={bh} fill={color} rx={1}>
              <title>
                {s.day}: {s.value}
              </title>
            </rect>
            {i % 5 === 0 ? (
              <text x={i * bw + bw / 2} y={h + 13} fontSize="9" textAnchor="middle" fill="#71717a">
                {s.day.slice(5)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function bucketByDay(dates: Date[], days: number) {
  const today = dayKey();
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) counts.set(shiftDay(today, -i), 0);
  for (const d of dates) {
    const k = dayKey(d);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].map(([day, value]) => ({ day, value }));
}

export default async function AnalyticsPage() {
  await requireRole("/admin/analytics", "ADMIN");
  const days = 30;
  const since = daysAgo(days);
  const [users, coursesPublished, enrollments, completions, recentEnrollments, recentCompletions, active7, active30, attempts, pendingGrading, deliveries, revenue, topCourses] =
    await Promise.all([
      db.user.count(),
      db.course.count({ where: { status: "PUBLISHED" } }),
      db.enrollment.count(),
      db.enrollment.count({ where: { completedAt: { not: null } } }),
      db.enrollment.findMany({ where: { enrolledAt: { gte: since } }, select: { enrolledAt: true } }),
      db.enrollment.findMany({ where: { completedAt: { gte: since } }, select: { completedAt: true } }),
      db.activityDay.findMany({ where: { day: { gte: shiftDay(dayKey(), -6) } }, distinct: ["userId"], select: { userId: true } }),
      db.activityDay.findMany({ where: { day: { gte: shiftDay(dayKey(), -29) } }, distinct: ["userId"], select: { userId: true } }),
      db.quizAttempt.findMany({ where: { status: { not: "IN_PROGRESS" } }, select: { passed: true, score: true } }),
      db.quizAttempt.count({ where: { status: "PENDING" } }),
      db.webhookDelivery.groupBy({ by: ["state"], _count: { _all: true } }),
      db.purchase.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amountCents: true }, _count: { _all: true } }),
      db.course.findMany({
        where: { status: "PUBLISHED" },
        include: { enrollments: { select: { completedAt: true } }, instructor: { select: { name: true } } },
        orderBy: { enrollments: { _count: "desc" } },
        take: 8,
      }),
    ]);
  const passRate = attempts.length ? pct(attempts.filter((a) => a.passed).length, attempts.length) : 0;
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;
  const wh = Object.fromEntries(deliveries.map((d) => [d.state, d._count._all])) as Record<string, number>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Analytics"
        subtitle="Platform-wide usage, learning outcomes and operational health."
        actions={
          <div className="flex gap-4 text-sm">
            <Link href="/admin/users" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              Users
            </Link>
            <Link href="/admin/orgs" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              Organizations
            </Link>
            <Link href="/admin/audit" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              Audit log
            </Link>
            <a href="/api/health" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              Health
            </a>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Learners & staff" value={users} hint={`${active7.length} active in 7 days · ${active30.length} in 30`} />
        <Stat label="Published courses" value={coursesPublished} />
        <Stat label="Enrollments" value={enrollments} hint={`${recentEnrollments.length} in the last ${days} days`} />
        <Stat label="Completions" value={completions} hint={enrollments ? `${pct(completions, enrollments)}% completion rate` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Enrollments per day (last {days} days)</h2>
          <Bars series={bucketByDay(recentEnrollments.map((e) => e.enrolledAt), days)} label="Enrollments per day" />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Completions per day (last {days} days)</h2>
          <Bars series={bucketByDay(recentCompletions.map((e) => e.completedAt!), days)} color="#059669" label="Completions per day" />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Quiz attempts" value={attempts.length} hint={attempts.length ? `${passRate}% pass rate · avg ${avgScore}%` : undefined} />
        <Stat label="Awaiting grading" value={pendingGrading} hint="essay answers in instructor queues" />
        <Stat label="Webhook deliveries" value={(wh.DELIVERED ?? 0) + (wh.FAILED ?? 0) + (wh.PENDING ?? 0) + (wh.DEAD ?? 0)} hint={`${wh.DELIVERED ?? 0} delivered · ${(wh.FAILED ?? 0) + (wh.PENDING ?? 0)} retrying · ${wh.DEAD ?? 0} dead`} />
        <Stat
          label="Revenue (paid)"
          value={revenue.length ? revenue.map((r) => formatMoney(r._sum.amountCents ?? 0, r.currency)).join(" · ") : "—"}
          hint={revenue.length ? `${revenue.reduce((n, r) => n + r._count._all, 0)} purchase(s)` : "no paid courses yet"}
        />
      </div>

      <Card className="mt-6 p-0">
        <h2 className="px-5 pt-5 text-sm font-semibold">Top courses</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-5 py-2">Course</th>
              <th className="px-5 py-2">Instructor</th>
              <th className="px-5 py-2">Enrolled</th>
              <th className="px-5 py-2">Completed</th>
              <th className="px-5 py-2">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {topCourses.map((c) => {
              const done = c.enrollments.filter((e) => e.completedAt).length;
              return (
                <tr key={c.id}>
                  <td className="px-5 py-2">
                    <Link href={`/author/${c.id}`} className="hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-zinc-500">{c.instructor.name}</td>
                  <td className="px-5 py-2">{c.enrollments.length}</td>
                  <td className="px-5 py-2">{done}</td>
                  <td className="px-5 py-2">{c.enrollments.length ? `${pct(done, c.enrollments.length)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
