import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { setUserRole } from "@/lib/actions/admin";
import { ROLES } from "@/lib/constants";
import { PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const admin = await requireRole("/admin/users", "ADMIN");
  const [users, orgs] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { courses: true, enrollments: true } }, organization: { select: { id: true, name: true } } },
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="Users"
        subtitle="Roles decide who can author; organizations scope the catalog (ADMIN-3, ADMIN-6)."
        actions={
          <Link href="/admin/orgs" className="text-sm text-indigo-600 hover:underline">
            Organizations →
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Org admin</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => {
              const self = u.id === admin.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {u.name}
                      {self ? <span className="ml-2 text-xs text-zinc-400">(you)</span> : null}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {u.email} · joined {formatDate(u.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {u._count.courses} course{u._count.courses === 1 ? "" : "s"} · {u._count.enrollments} enrollment{u._count.enrollments === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3" colSpan={4}>
                    <form action={setUserRole} className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="userId" value={u.id} />
                      <Select name="role" defaultValue={u.role} disabled={self} aria-label={`Role for ${u.name}`}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0) + r.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </Select>
                      <Select name="organizationId" defaultValue={u.organization?.id ?? ""} aria-label={`Organization for ${u.name}`}>
                        <option value="">No organization</option>
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" name="orgAdmin" defaultChecked={u.orgAdmin} /> Org admin
                      </label>
                      {/* Disabled selects are not submitted; keep the admin's own role. */}
                      {self ? <input type="hidden" name="role" value={u.role} /> : null}
                      <SubmitButton variant="secondary" size="sm" pendingText="…">
                        Save
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
