"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { assertCourseAccess } from "@/lib/courses";
import { createVersion, restoreVersion } from "@/lib/versions";
import { formStr } from "@/lib/validation";

/** Manually save a snapshot of the current course (AUTHOR-13). */
export async function saveVersion(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  await assertCourseAccess(courseId, user);
  await createVersion(courseId, user.id, formStr(formData, "note").trim().slice(0, 200));
  revalidatePath(`/author/${courseId}/versions`);
}

/** Restore a snapshot into the live course; the current state is snapshotted first so nothing is lost. */
export async function restoreCourseVersion(formData: FormData) {
  const user = await actionAuthor();
  const versionId = formStr(formData, "versionId");
  const v = await db.courseVersion.findUnique({ where: { id: versionId }, select: { courseId: true, number: true } });
  if (!v) throw new Error("Version not found.");
  const course = await assertCourseAccess(v.courseId, user);
  await createVersion(v.courseId, user.id, `Auto-saved before restoring v${v.number}`);
  await restoreVersion(versionId);
  revalidatePath(`/author/${v.courseId}`, "layout");
  revalidatePath(`/courses/${course.slug}`);
  revalidatePath(`/learn/${course.slug}`, "layout");
  redirect(`/author/${v.courseId}?restored=${v.number}`);
}
