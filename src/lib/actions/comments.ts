"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionUser, canAuthor, isAdmin } from "@/lib/auth";
import { formStr } from "@/lib/validation";

async function lessonCourse(lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, module: { select: { course: { select: { id: true, slug: true, instructorId: true } } } } },
  });
  if (!lesson) throw new Error("Lesson not found.");
  return lesson.module.course;
}

/** Post a comment or reply on a lesson. Enrolled learners, the course's instructor and admins may post (LEARN-13). */
export async function postComment(formData: FormData) {
  const user = await actionUser();
  const lessonId = formStr(formData, "lessonId");
  const parentId = formStr(formData, "parentId") || null;
  const body = formStr(formData, "body").trim();
  if (!body) return;
  if (body.length > 5000) throw new Error("Comment is too long (5000 characters max).");

  const course = await lessonCourse(lessonId);
  const enrolled = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } }, select: { id: true } });
  const mayPost = !!enrolled || isAdmin(user) || course.instructorId === user.id;
  if (!mayPost) throw new Error("Enroll in the course to join the discussion.");

  if (parentId) {
    const parent = await db.comment.findUnique({ where: { id: parentId }, select: { lessonId: true, parentId: true } });
    if (!parent || parent.lessonId !== lessonId) throw new Error("Reply target not found.");
    if (parent.parentId) throw new Error("Replies are one level deep.");
  }

  await db.comment.create({ data: { lessonId, userId: user.id, parentId, body } });
  revalidatePath(`/learn/${course.slug}/${lessonId}`);
}

/** Soft-delete: author of the comment, course instructor or admin. */
export async function deleteComment(formData: FormData) {
  const user = await actionUser();
  const commentId = formStr(formData, "commentId");
  const c = await db.comment.findUnique({ where: { id: commentId }, select: { userId: true, lessonId: true } });
  if (!c) throw new Error("Comment not found.");
  const course = await lessonCourse(c.lessonId);
  const may = c.userId === user.id || isAdmin(user) || (canAuthor(user) && course.instructorId === user.id);
  if (!may) throw new Error("You cannot delete this comment.");
  await db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date(), body: "" } });
  revalidatePath(`/learn/${course.slug}/${c.lessonId}`);
}
