import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateOrgForm } from "@/components/OrgForms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Organizations" };

export default async function AdminOrgsPage() {
  await requireRole("/admin/orgs", "ADMIN");
  const orgs = await db.organization.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, courses: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Organizations"
        subtitle="Each organization has its own private catalog and admins (ADMIN-6)."
        actions={
          <Link href="/admin/users" className="text-sm text-indigo-600 hover:underline">
            Manage users →
          </Link>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          {orgs.length === 0 ? (
            <EmptyState title="No organizations yet" body="Create one, then assign users to it from the Users page or add members by email." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                  <tr>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Members</th>
                    <th className="px-4 py-3">Courses</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {orgs.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/orgs/${o.id}`} className="font-medium hover:text-indigo-600 hover:underline">
                          {o.name}
                        </Link>
                        <div className="text-xs text-zinc-500">{o.slug}</div>
                      </td>
                      <td className="px-4 py-3">{o._count.users}</td>
                      <td className="px-4 py-3">{o._count.courses}</td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">New organization</h2>
            <CreateOrgForm />
          </Card>
        </aside>
      </div>
    </div>
  );
}
