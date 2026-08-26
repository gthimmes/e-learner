"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionUser, getCurrentUser } from "@/lib/auth";
import { accessSelect, canViewCourse } from "@/lib/courses";
import { formStr } from "@/lib/validation";

export async function enroll(formData: FormData) {
  const courseId = formStr(formData, "courseId");
  const user = await getCurrentUser();
  const course = await db.course.findUnique({ where: { id: courseId }, select: { ...accessSelect, status: true } });
  if (!course) throw new Error("Course not found.");
  if (!user) redirect(`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`);
  if (course.status !== "PUBLISHED") throw new Error("This course is not open for enrollment.");
  if (!canViewCourse(user, course)) throw new Error("This course is private to another organization.");

  await db.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    create: { userId: user.id, courseId },
    update: {},
  });
  revalidatePath("/learn");
  revalidatePath(`/courses/${course.slug}`);
  redirect(`/learn/${course.slug}`);
}

/** Records the lesson the learner is currently viewing (for "Resume"). */
export async function touchLesson(lessonId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!lesson) return;
  await db.enrollment.updateMany({
    where: { userId: user.id, courseId: lesson.module.courseId },
    data: { lastLessonId: lessonId },
  });
}

async function loadEnrollmentForLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true, module: { select: { course: { select: { id: true, slug: true } } } } },
  });
  if (!lesson) throw new Error("Lesson not found.");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.module.course.id } },
  });
  if (!enrollment) throw new Error("You are not enrolled in this course.");
  return { lesson, enrollment, course: lesson.module.course };
}

/** Marks a lesson complete; also completes the course when every lesson is done. */
export async function markLessonComplete(enrollmentId: string, lessonId: string, courseId: string) {
  await db.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    create: { enrollmentId, lessonId },
    update: {},
  });
  const [total, done] = await Promise.all([
    db.lesson.count({ where: { module: { courseId } } }),
    db.lessonProgress.count({ where: { enrollmentId } }),
  ]);
  if (total > 0 && done >= total) {
    await db.enrollment.update({ where: { id: enrollmentId }, data: { completedAt: new Date(), lastLessonId: lessonId } });
    return true;
  }
  await db.enrollment.update({ where: { id: enrollmentId }, data: { lastLessonId: lessonId } });
  return false;
}

/** Form action: "Mark complete & continue". Quiz lessons complete only through a passing attempt. */
export async function completeLesson(formData: FormData) {
  const user = await actionUser();
  const lessonId = formStr(formData, "lessonId");
  const nextLessonId = formStr(formData, "nextLessonId");
  const { lesson, enrollment, course } = await loadEnrollmentForLesson(user.id, lessonId);
  if (lesson.type === "QUIZ") throw new Error("Pass the quiz to complete this lesson.");

  const courseDone = await markLessonComplete(enrollment.id, lessonId, course.id);
  revalidatePath(`/learn/${course.slug}`, "layout");
  revalidatePath("/learn");
  if (courseDone && !nextLessonId) redirect(`/learn/${course.slug}/done`);
  redirect(nextLessonId ? `/learn/${course.slug}/${nextLessonId}` : `/learn/${course.slug}/done`);
}

export async function uncompleteLesson(formData: FormData) {
  const user = await actionUser();
  const lessonId = formStr(formData, "lessonId");
  const { enrollment, course } = await loadEnrollmentForLesson(user.id, lessonId);
  await db.lessonProgress.deleteMany({ where: { enrollmentId: enrollment.id, lessonId } });
  await db.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: null } });
  revalidatePath(`/learn/${course.slug}`, "layout");
  revalidatePath("/learn");
}

export async function unenroll(formData: FormData) {
  const user = await actionUser();
  const courseId = formStr(formData, "courseId");
  await db.enrollment.deleteMany({ where: { userId: user.id, courseId } });
  revalidatePath("/learn");
  redirect("/learn");
}
