import Link from "next/link";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { removeMember, setOrgAdmin, updateOrganization } from "@/lib/actions/org";
import { AddMembersForm } from "./OrgForms";
import { Badge, Button, Card, Input, StatusBadge } from "./ui";
import { formatDate } from "@/lib/utils";

/** Organization management shared by /org (org admins) and /admin/orgs/[id] (platform admins). */
export async function OrgPanel({ orgId, viewer }: { orgId: string; viewer: SessionUser }) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      users: { orderBy: [{ orgAdmin: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, orgAdmin: true, createdAt: true } },
      courses: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, instructor: { select: { name: true } }, _count: { select: { enrollments: true } } } },
    },
  });
  if (!org) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Members <span className="text-sm font-normal text-zinc-500">· {org.users.length}</span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Platform role</th>
                  <th className="px-4 py-3">Org admin</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {org.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {u.name} {u.id === viewer.id ? <span className="text-xs text-zinc-500">(you)</span> : null}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {u.email} · joined {formatDate(u.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "LEARNER" ? "neutral" : "info"}>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <form action={setOrgAdmin} className="flex items-center gap-2">
                        <input type="hidden" name="orgId" value={org.id} />
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="orgAdmin" value={u.orgAdmin ? "" : "on"} />
                        <button className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800">{u.orgAdmin ? "Revoke admin" : "Make admin"}</button>
                        {u.orgAdmin ? <Badge tone="success">Admin</Badge> : null}
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={removeMember}>
                        <input type="hidden" name="orgId" value={org.id} />
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="text-xs text-zinc-500 hover:text-red-600">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {org.users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                      No members yet — add people by email.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Courses <span className="text-sm font-normal text-zinc-500">· {org.courses.length} private to this organization</span>
          </h2>
          {org.courses.length === 0 ? (
            <p className="text-sm text-zinc-500">Courses created by members are automatically private to the organization.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {org.courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <Link href={`/author/${c.id}`} className="font-medium hover:text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
                      {c.title}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      by {c.instructor.name} · {c._count.enrollments} enrolled
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <Card>
          <h2 className="text-sm font-semibold">Settings</h2>
          <form action={updateOrganization} className="mt-2 space-y-2">
            <input type="hidden" name="orgId" value={org.id} />
            <Input name="name" defaultValue={org.name} aria-label="Organization name" required />
            <Input name="tagline" defaultValue={org.tagline} placeholder="Tagline (shown in the footer)" aria-label="Tagline" maxLength={120} />
            <Input name="logoUrl" defaultValue={org.logoUrl ?? ""} placeholder="Logo URL (square image)" aria-label="Logo URL" />
            <div className="flex items-center gap-2">
              <label htmlFor="org-color" className="text-xs text-zinc-500">
                Primary colour
              </label>
              <input id="org-color" type="color" name="primaryColor" defaultValue={org.primaryColor || "#4f46e5"} className="h-8 w-12 cursor-pointer rounded border border-zinc-300" />
              <label className="flex items-center gap-1 text-xs text-zinc-500">
                <input type="checkbox" name="resetColor" /> use platform default
              </label>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Save branding
            </Button>
          </form>
          <p className="mt-2 text-xs text-zinc-500">Members see your name, logo and colour across the app.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Slug: <code>{org.slug}</code> · created {formatDate(org.createdAt)}
          </p>
        </Card>
        <Card>
          <AddMembersForm orgId={org.id} />
        </Card>
      </aside>
    </div>
  );
}
