import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getAuditLog } from "@/lib/audit";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireRole("/admin/audit", "ADMIN");
  const rows = await getAuditLog(300);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Audit log"
        subtitle="Who changed what: roles, organizations, publishing, refunds, keys and webhooks."
        actions={
          <Link href="/admin/analytics" className="text-sm text-indigo-600 hover:underline">
            ← Analytics
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No entries yet" body="Privileged actions are recorded here as they happen." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td className="px-4 py-2">{r.actorEmail || "system"}</td>
                  <td className="px-4 py-2">
                    <code className="text-xs">{r.action}</code>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{r.targetType ? `${r.targetType} ${r.targetId}` : "—"}</td>
                  <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-zinc-500" title={r.meta}>
                    {r.meta === "{}" ? "" : r.meta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
