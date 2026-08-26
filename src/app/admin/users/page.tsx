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
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { courses: true, enrollments: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Users" subtitle="Manage who can author courses and who administers the platform (ADMIN-3)." />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Courses</th>
              <th className="px-4 py-3">Enrollments</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">
                  {u.name}
                  {u.id === admin.id ? <span className="ml-2 text-xs text-zinc-400">(you)</span> : null}
                </td>
                <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">{u._count.courses}</td>
                <td className="px-4 py-3">{u._count.enrollments}</td>
                <td className="px-4 py-3">
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <Select name="role" defaultValue={u.role} disabled={u.id === admin.id} aria-label={`Role for ${u.name}`}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </Select>
                    {u.id !== admin.id ? (
                      <SubmitButton variant="secondary" size="sm" pendingText="…">
                        Save
                      </SubmitButton>
                    ) : null}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
