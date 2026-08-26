import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteOrganization } from "@/lib/actions/org";
import { OrgPanel } from "@/components/OrgPanel";
import { LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Organization" };

export default async function AdminOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const admin = await requireRole(`/admin/orgs/${orgId}`, "ADMIN");
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  if (!org) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={org.name}
        subtitle="Platform admin view of this organization."
        actions={
          <>
            <LinkButton href="/admin/orgs" variant="secondary">
              ← All organizations
            </LinkButton>
            <form action={deleteOrganization}>
              <input type="hidden" name="orgId" value={orgId} />
              <SubmitButton variant="danger" pendingText="Deleting…">
                Delete organization
              </SubmitButton>
            </form>
          </>
        }
      />
      <OrgPanel orgId={orgId} viewer={admin} />
    </div>
  );
}
