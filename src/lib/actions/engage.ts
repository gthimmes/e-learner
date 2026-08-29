"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser } from "@/lib/auth";
import { assertCourseAccess } from "@/lib/courses";
import { publishAnnouncement } from "@/lib/engage";
import { formBool, formStr } from "@/lib/validation";

export async function markAllNotificationsRead() {
  const user = await actionUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function createAnnouncement(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const course = await assertCourseAccess(courseId, user);
  const title = formStr(formData, "title").trim().slice(0, 140);
  const body = formStr(formData, "body").trim().slice(0, 20_000);
  if (!title) throw new Error("Title is required.");
  await publishAnnouncement({ courseId, authorId: user.id, title, body, email: formBool(formData, "email") });
  revalidatePath(`/author/${courseId}/announcements`);
  revalidatePath(`/courses/${course.slug}`);
  revalidatePath("/", "layout");
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "announcementId");
  const a = await db.announcement.findUnique({ where: { id }, select: { courseId: true, course: { select: { slug: true } } } });
  if (!a) return;
  await assertCourseAccess(a.courseId, user);
  await db.announcement.delete({ where: { id } });
  revalidatePath(`/author/${a.courseId}/announcements`);
  revalidatePath(`/courses/${a.course.slug}`);
}
