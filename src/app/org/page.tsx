import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrgPanel } from "@/components/OrgPanel";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Organization" };

/** Org-admin console for the viewer's own organization (ADMIN-6). */
export default async function OrgPage() {
  const user = await requireUser("/org");
  if (!user.organizationId || !user.orgAdmin) redirect("/?denied=1");
  const org = await db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } });
  if (!org) redirect("/?denied=1");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={org.name} subtitle="Manage members and see the courses private to your organization." />
      <OrgPanel orgId={user.organizationId} viewer={user} />
    </div>
  );
}
