"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { assertCourseAccess } from "@/lib/courses";
import { formStr } from "@/lib/validation";
import type { RosterState } from "./roster";

/** Add a co-author by email (AUTHOR-12). They must already be an instructor or admin. */
export async function addCoAuthor(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const course = await assertCourseAccess(courseId, user);
  const email = formStr(formData, "email").trim().toLowerCase();
  if (!email) return { error: "Enter an email address." };

  const target = await db.user.findUnique({ where: { email }, select: { id: true, role: true, name: true, organizationId: true } });
  if (!target) return { error: `No account for ${email}. They need to register first.` };
  if (target.role === "LEARNER") return { error: `${target.name} is a learner. An admin must make them an instructor before they can co-author.` };
  if (target.id === course.instructorId) return { error: `${target.name} is already the course instructor.` };
  if (course.organizationId && target.organizationId !== course.organizationId) {
    return { error: `${target.name} is not a member of this course's organization.` };
  }

  await db.courseAuthor.upsert({
    where: { courseId_userId: { courseId, userId: target.id } },
    create: { courseId, userId: target.id },
    update: {},
  });
  revalidatePath(`/author/${courseId}`, "layout");
  revalidatePath("/author");
  return { message: `${target.name} can now edit this course.` };
}

export async function removeCoAuthor(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const userId = formStr(formData, "userId");
  await assertCourseAccess(courseId, user);
  await db.courseAuthor.deleteMany({ where: { courseId, userId } });
  revalidatePath(`/author/${courseId}`, "layout");
  revalidatePath("/author");
}
