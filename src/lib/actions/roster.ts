"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { assertCourseAccess } from "@/lib/courses";
import { formStr } from "@/lib/validation";

export type RosterState = { error?: string; message?: string };

/** Instructor/admin enrolls existing users by email — comma, space or newline separated (LEARN-11). */
export async function enrollByEmail(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  await assertCourseAccess(courseId, user);

  const emails = Array.from(
    new Set(
      formStr(formData, "emails")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (emails.length === 0) return { error: "Enter at least one email address." };

  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const found = new Set(users.map((u) => u.email));
  const missing = emails.filter((e) => !found.has(e));

  const existing = await db.enrollment.findMany({
    where: { courseId, userId: { in: users.map((u) => u.id) } },
    select: { userId: true },
  });
  const already = new Set(existing.map((e) => e.userId));
  const toAdd = users.filter((u) => !already.has(u.id));
  const cohortId = formStr(formData, "cohortId") || null;
  if (cohortId) {
    const c = await db.cohort.findUnique({ where: { id: cohortId }, select: { courseId: true } });
    if (!c || c.courseId !== courseId) return { error: "Cohort not found for this course." };
  }
  if (toAdd.length) {
    await db.enrollment.createMany({ data: toAdd.map((u) => ({ userId: u.id, courseId, cohortId })) });
  }
  if (cohortId && already.size) {
    await db.enrollment.updateMany({ where: { courseId, userId: { in: [...already] } }, data: { cohortId } });
  }
  revalidatePath(`/author/${courseId}/learners`);
  revalidatePath("/learn");

  const parts = [`Enrolled ${toAdd.length} learner${toAdd.length === 1 ? "" : "s"}.`];
  if (already.size) parts.push(`${already.size} already enrolled.`);
  if (missing.length) return { error: `${parts.join(" ")} No account for: ${missing.join(", ")} — they need to register first.` };
  return { message: parts.join(" ") };
}

export async function removeEnrollment(formData: FormData) {
  const user = await actionAuthor();
  const enrollmentId = formStr(formData, "enrollmentId");
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, select: { courseId: true } });
  if (!e) throw new Error("Enrollment not found.");
  await assertCourseAccess(e.courseId, user);
  await db.enrollment.delete({ where: { id: enrollmentId } });
  revalidatePath(`/author/${e.courseId}/learners`);
}
