"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { formBool, formStr } from "@/lib/validation";
import { audit } from "@/lib/audit";

/** Platform admin: set a user's role, organization and org-admin flag (AUTH-4, ADMIN-6). */
export async function setUserRole(formData: FormData) {
  const admin = await actionAdmin();
  const userId = formStr(formData, "userId");
  const role = formStr(formData, "role");
  const organizationId = formStr(formData, "organizationId") || null;
  const orgAdmin = formBool(formData, "orgAdmin") && !!organizationId;
  if (!(ROLES as readonly string[]).includes(role)) throw new Error("Invalid role");
  if (userId === admin.id && role !== "ADMIN") throw new Error("You cannot remove your own admin role.");
  if (organizationId && !(await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } }))) {
    throw new Error("Organization not found.");
  }
  await db.user.update({ where: { id: userId }, data: { role, organizationId, orgAdmin } });
  await audit(admin, "user.role", { type: "user", id: userId }, { role, organizationId, orgAdmin });
  revalidatePath("/admin/users");
  revalidatePath("/admin/orgs", "layout");
  revalidatePath("/org");
}
