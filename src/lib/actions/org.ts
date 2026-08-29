"use server";

import { audit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAdmin, actionUser, isAdmin, type SessionUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { formStr, formBool } from "@/lib/validation";
import type { RosterState } from "./roster";

function revalidateOrg(orgId?: string) {
  revalidatePath("/admin/orgs");
  revalidatePath("/admin/users");
  revalidatePath("/org");
  revalidatePath("/");
  if (orgId) revalidatePath(`/admin/orgs/${orgId}`);
}

/** Org admins manage their own org; platform admins manage any. */
async function assertOrgAccess(orgId: string, user: SessionUser) {
  if (isAdmin(user)) return;
  if (!user.orgAdmin || user.organizationId !== orgId) throw new Error("Organization access denied.");
}

// ---------- Platform admin ----------

export async function createOrganization(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const admin = await actionAdmin();
  const name = formStr(formData, "name").trim();
  const slug = formStr(formData, "slug").trim() || slugify(name);
  if (!name) return { error: "Name is required." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Slug may contain lowercase letters, numbers and hyphens." };
  if (await db.organization.findUnique({ where: { slug } })) return { error: "That slug is already in use." };
  const org = await db.organization.create({ data: { name, slug } });
  await audit(admin, "org.create", { type: "organization", id: org.id }, { name, slug });
  revalidateOrg(org.id);
  redirect(`/admin/orgs/${org.id}`);
}

export async function deleteOrganization(formData: FormData) {
  const admin = await actionAdmin();
  const orgId = formStr(formData, "orgId");
  await db.organization.delete({ where: { id: orgId } });
  await audit(admin, "org.delete", { type: "organization", id: orgId }); // users/courses keep existing; organizationId → null
  revalidateOrg();
  redirect("/admin/orgs");
}

// ---------- Org admin or platform admin ----------

export async function updateOrganization(formData: FormData) {
  const user = await actionUser();
  const orgId = formStr(formData, "orgId");
  await assertOrgAccess(orgId, user);
  const name = formStr(formData, "name").trim();
  if (!name) throw new Error("Name is required.");
  await db.organization.update({ where: { id: orgId }, data: { name } });
  revalidateOrg(orgId);
}

/** Add existing users to the organization by email. Users already in another org are skipped. */
export async function addMembers(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const user = await actionUser();
  const orgId = formStr(formData, "orgId");
  await assertOrgAccess(orgId, user);
  const emails = Array.from(new Set(formStr(formData, "emails").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (!emails.length) return { error: "Enter at least one email address." };

  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, organizationId: true } });
  const found = new Set(users.map((u) => u.email));
  const missing = emails.filter((e) => !found.has(e));
  const elsewhere = users.filter((u) => u.organizationId && u.organizationId !== orgId);
  const toAdd = users.filter((u) => !u.organizationId);
  const already = users.length - elsewhere.length - toAdd.length;

  if (toAdd.length) await db.user.updateMany({ where: { id: { in: toAdd.map((u) => u.id) } }, data: { organizationId: orgId } });
  revalidateOrg(orgId);

  const parts = [`Added ${toAdd.length} member${toAdd.length === 1 ? "" : "s"}.`];
  if (already) parts.push(`${already} already a member.`);
  const problems: string[] = [];
  if (elsewhere.length) problems.push(`already in another organization: ${elsewhere.map((u) => u.email).join(", ")}`);
  if (missing.length) problems.push(`no account: ${missing.join(", ")}`);
  if (problems.length) return { error: `${parts.join(" ")} Skipped — ${problems.join("; ")}.` };
  return { message: parts.join(" ") };
}

export async function removeMember(formData: FormData) {
  const user = await actionUser();
  const orgId = formStr(formData, "orgId");
  const userId = formStr(formData, "userId");
  await assertOrgAccess(orgId, user);
  if (userId === user.id && !isAdmin(user)) throw new Error("You cannot remove yourself.");
  await db.user.updateMany({ where: { id: userId, organizationId: orgId }, data: { organizationId: null, orgAdmin: false } });
  revalidateOrg(orgId);
}

export async function setOrgAdmin(formData: FormData) {
  const user = await actionUser();
  const orgId = formStr(formData, "orgId");
  const userId = formStr(formData, "userId");
  const orgAdmin = formBool(formData, "orgAdmin");
  await assertOrgAccess(orgId, user);
  if (userId === user.id && !orgAdmin && !isAdmin(user)) throw new Error("You cannot remove your own org-admin role.");
  await db.user.updateMany({ where: { id: userId, organizationId: orgId }, data: { orgAdmin } });
  revalidateOrg(orgId);
}
