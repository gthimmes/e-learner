"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { assertCourseAccess } from "@/lib/courses";
import { formStr } from "@/lib/validation";

const parseDate = (s: string) => (s ? new Date(s) : null);

function revalidate(courseId: string) {
  revalidatePath(`/author/${courseId}/learners`);
  revalidatePath("/learn", "layout");
}

/** Create a cohort with optional start / end / due dates (LEARN-12). */
export async function createCohort(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  await assertCourseAccess(courseId, user);
  const name = formStr(formData, "name").trim() || "New cohort";
  await db.cohort.create({
    data: {
      courseId,
      name,
      startsAt: parseDate(formStr(formData, "startsAt")) ?? new Date(),
      endsAt: parseDate(formStr(formData, "endsAt")),
      dueAt: parseDate(formStr(formData, "dueAt")),
    },
  });
  revalidate(courseId);
}

export async function updateCohort(formData: FormData) {
  const user = await actionAuthor();
  const cohortId = formStr(formData, "cohortId");
  const cohort = await db.cohort.findUnique({ where: { id: cohortId }, select: { courseId: true } });
  if (!cohort) throw new Error("Cohort not found.");
  await assertCourseAccess(cohort.courseId, user);
  await db.cohort.update({
    where: { id: cohortId },
    data: {
      name: formStr(formData, "name").trim() || "Cohort",
      startsAt: parseDate(formStr(formData, "startsAt")) ?? new Date(),
      endsAt: parseDate(formStr(formData, "endsAt")),
      dueAt: parseDate(formStr(formData, "dueAt")),
    },
  });
  revalidate(cohort.courseId);
}

export async function deleteCohort(formData: FormData) {
  const user = await actionAuthor();
  const cohortId = formStr(formData, "cohortId");
  const cohort = await db.cohort.findUnique({ where: { id: cohortId }, select: { courseId: true } });
  if (!cohort) throw new Error("Cohort not found.");
  await assertCourseAccess(cohort.courseId, user);
  await db.cohort.delete({ where: { id: cohortId } }); // enrollments keep their progress; cohortId → null
  revalidate(cohort.courseId);
}

/** Move an enrollment into a cohort (or out of any cohort with an empty value). */
export async function setEnrollmentCohort(formData: FormData) {
  const user = await actionAuthor();
  const enrollmentId = formStr(formData, "enrollmentId");
  const cohortId = formStr(formData, "cohortId") || null;
  const e = await db.enrollment.findUnique({ where: { id: enrollmentId }, select: { courseId: true } });
  if (!e) throw new Error("Enrollment not found.");
  await assertCourseAccess(e.courseId, user);
  if (cohortId) {
    const c = await db.cohort.findUnique({ where: { id: cohortId }, select: { courseId: true } });
    if (!c || c.courseId !== e.courseId) throw new Error("Cohort belongs to another course.");
  }
  await db.enrollment.update({ where: { id: enrollmentId }, data: { cohortId } });
  revalidate(e.courseId);
}
