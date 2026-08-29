"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { canEditCourse, accessSelect } from "@/lib/courses";
import { firstIssue, formStr, reviewSchema } from "@/lib/validation";
import type { ActionState } from "./auth";

/** Enrolled learners can rate a course once; re-submitting updates the review (LEARN-16). */
export async function submitReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser();
  const courseId = formStr(formData, "courseId");
  const parsed = reviewSchema.safeParse({ rating: formStr(formData, "rating"), body: formStr(formData, "body") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    include: { course: { select: { slug: true } } },
  });
  if (!enrollment) return { error: "Enroll in the course before reviewing it." };
  await db.review.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    update: parsed.data,
    create: { ...parsed.data, userId: user.id, courseId },
  });
  revalidatePath("/");
  revalidatePath(`/courses/${enrollment.course.slug}`);
  return { ok: true };
}

/** Learners remove their own review; course editors moderate any review. */
export async function deleteReview(formData: FormData) {
  const user = await actionUser();
  const reviewId = formStr(formData, "reviewId");
  const review = await db.review.findUnique({ where: { id: reviewId }, include: { course: { select: accessSelect } } });
  if (!review) return;
  if (review.userId !== user.id && !canEditCourse(user, review.course)) throw new Error("Access denied.");
  await db.review.delete({ where: { id: reviewId } });
  revalidatePath("/");
  revalidatePath(`/courses/${review.course.slug}`);
}
