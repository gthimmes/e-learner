"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { formStr } from "@/lib/validation";

export async function setUserRole(formData: FormData) {
  const admin = await actionAdmin();
  const userId = formStr(formData, "userId");
  const role = formStr(formData, "role");
  if (!(ROLES as readonly string[]).includes(role)) throw new Error("Invalid role");
  if (userId === admin.id && role !== "ADMIN") throw new Error("You cannot remove your own admin role.");
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}
