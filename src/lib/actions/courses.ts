"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor } from "@/lib/auth";
import { assertCourseAccess, assertLessonAccess, assertModuleAccess, isSlugTaken } from "@/lib/courses";
import { courseSchema, firstIssue, formBool, formStr, lessonSchema, moduleSchema, parsePriceCents } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { createVersion } from "@/lib/versions";
import type { ActionState } from "./auth";

function revalidateCourse(courseId: string, slug?: string) {
  revalidatePath("/");
  revalidatePath("/author");
  revalidatePath(`/author/${courseId}`, "layout");
  if (slug) {
    revalidatePath(`/courses/${slug}`);
    revalidatePath(`/learn/${slug}`, "layout");
  }
}

// ---------- Courses ----------

export async function createCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionAuthor();
  const title = formStr(formData, "title");
  const parsed = courseSchema.safeParse({
    title,
    slug: formStr(formData, "slug") || slugify(title),
    summary: formStr(formData, "summary"),
    description: formStr(formData, "description"),
    coverUrl: formStr(formData, "coverUrl"),
    sequential: formBool(formData, "sequential"),
    priceCents: parsePriceCents(formStr(formData, "price")),
    currency: formStr(formData, "currency") || "usd",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (await isSlugTaken(parsed.data.slug)) return { error: "That slug is already in use." };

  const course = await db.course.create({
    data: {
      ...parsed.data,
      coverUrl: parsed.data.coverUrl || null,
      instructorId: user.id,
      organizationId: user.organizationId, // org members author private-to-org courses (ADMIN-6)
      modules: { create: { title: "Module 1", position: 0 } },
    },
  });
  revalidateCourse(course.id, course.slug);
  redirect(`/author/${course.id}`);
}

export async function updateCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const existing = await assertCourseAccess(courseId, user);
  const parsed = courseSchema.safeParse({
    title: formStr(formData, "title"),
    slug: formStr(formData, "slug"),
    summary: formStr(formData, "summary"),
    description: formStr(formData, "description"),
    coverUrl: formStr(formData, "coverUrl"),
    sequential: formBool(formData, "sequential"),
    priceCents: parsePriceCents(formStr(formData, "price")),
    currency: formStr(formData, "currency") || "usd",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (await isSlugTaken(parsed.data.slug, courseId)) return { error: "That slug is already in use." };

  await db.course.update({
    where: { id: courseId },
    data: { ...parsed.data, coverUrl: parsed.data.coverUrl || null },
  });
  revalidateCourse(courseId, existing.slug);
  revalidateCourse(courseId, parsed.data.slug);
  return { ok: true };
}

export async function setCourseStatus(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const status = formStr(formData, "status");
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) throw new Error("Invalid status");
  const course = await assertCourseAccess(courseId, user);

  if (status === "PUBLISHED") {
    const lessonCount = await db.lesson.count({ where: { module: { courseId } } });
    if (lessonCount === 0) redirect(`/author/${courseId}?error=${encodeURIComponent("Add at least one lesson before publishing.")}`);
  }
  await db.course.update({
    where: { id: courseId },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined },
  });
  if (status === "PUBLISHED") await createVersion(courseId, user.id, "Published"); // AUTHOR-13
  revalidateCourse(courseId, course.slug);
  redirect(`/author/${courseId}`);
}

export async function deleteCourse(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const course = await assertCourseAccess(courseId, user);
  await db.course.delete({ where: { id: courseId } });
  revalidateCourse(courseId, course.slug);
  redirect("/author");
}

// ---------- Modules ----------

export async function createModule(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  await assertCourseAccess(courseId, user);
  const parsed = moduleSchema.safeParse({ title: formStr(formData, "title") || "New module", summary: "" });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const count = await db.module.count({ where: { courseId } });
  await db.module.create({ data: { ...parsed.data, courseId, position: count } });
  revalidateCourse(courseId);
}

export async function updateModule(formData: FormData) {
  const user = await actionAuthor();
  const moduleId = formStr(formData, "moduleId");
  const mod = await assertModuleAccess(moduleId, user);
  const parsed = moduleSchema.safeParse({ title: formStr(formData, "title"), summary: formStr(formData, "summary") });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  await db.module.update({ where: { id: moduleId }, data: parsed.data });
  revalidateCourse(mod.courseId);
}

export async function deleteModule(formData: FormData) {
  const user = await actionAuthor();
  const moduleId = formStr(formData, "moduleId");
  const mod = await assertModuleAccess(moduleId, user);
  await db.module.delete({ where: { id: moduleId } });
  await normalizeModulePositions(mod.courseId);
  revalidateCourse(mod.courseId);
}

export async function moveModule(formData: FormData) {
  const user = await actionAuthor();
  const moduleId = formStr(formData, "moduleId");
  const dir = formStr(formData, "dir") === "up" ? -1 : 1;
  const mod = await assertModuleAccess(moduleId, user);
  const siblings = await db.module.findMany({ where: { courseId: mod.courseId }, orderBy: { position: "asc" } });
  const idx = siblings.findIndex((m) => m.id === moduleId);
  const swap = siblings[idx + dir];
  if (swap) {
    await db.$transaction([
      db.module.update({ where: { id: mod.id }, data: { position: idx + dir } }),
      db.module.update({ where: { id: swap.id }, data: { position: idx } }),
    ]);
  }
  revalidateCourse(mod.courseId);
}

async function normalizeModulePositions(courseId: string) {
  const mods = await db.module.findMany({ where: { courseId }, orderBy: { position: "asc" } });
  await db.$transaction(mods.map((m, i) => db.module.update({ where: { id: m.id }, data: { position: i } })));
}

// ---------- Lessons ----------

export async function createLesson(formData: FormData) {
  const user = await actionAuthor();
  const moduleId = formStr(formData, "moduleId");
  const mod = await assertModuleAccess(moduleId, user);
  const type = formStr(formData, "type") || "TEXT";
  const parsed = lessonSchema.safeParse({ title: formStr(formData, "title") || "New lesson", type });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));
  const count = await db.lesson.count({ where: { moduleId } });
  const lesson = await db.lesson.create({ data: { ...parsed.data, mediaUrl: null, moduleId, position: count } });
  revalidateCourse(mod.courseId);
  redirect(`/author/${mod.courseId}/lessons/${lesson.id}`);
}

export async function updateLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionAuthor();
  const lessonId = formStr(formData, "lessonId");
  const lesson = await assertLessonAccess(lessonId, user);
  const parsed = lessonSchema.safeParse({
    title: formStr(formData, "title"),
    type: formStr(formData, "type"),
    body: formStr(formData, "body"),
    mediaUrl: formStr(formData, "mediaUrl"),
    mediaCaption: formStr(formData, "mediaCaption"),
    durationMin: formStr(formData, "durationMin") || 0,
    passingScore: formStr(formData, "passingScore") || 70,
    maxAttempts: formStr(formData, "maxAttempts") || 0,
    shuffleQuestions: formBool(formData, "shuffleQuestions"),
    showAnswers: formBool(formData, "showAnswers"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await db.lesson.update({
    where: { id: lessonId },
    data: { ...parsed.data, mediaUrl: parsed.data.mediaUrl || null },
  });
  revalidateCourse(lesson.module.course.id);
  return { ok: true };
}

export async function deleteLesson(formData: FormData) {
  const user = await actionAuthor();
  const lessonId = formStr(formData, "lessonId");
  const lesson = await assertLessonAccess(lessonId, user);
  await db.lesson.delete({ where: { id: lessonId } });
  await normalizeLessonPositions(lesson.moduleId);
  revalidateCourse(lesson.module.course.id);
  redirect(`/author/${lesson.module.course.id}`);
}

export async function moveLesson(formData: FormData) {
  const user = await actionAuthor();
  const lessonId = formStr(formData, "lessonId");
  const dir = formStr(formData, "dir") === "up" ? -1 : 1;
  const lesson = await assertLessonAccess(lessonId, user);
  const siblings = await db.lesson.findMany({ where: { moduleId: lesson.moduleId }, orderBy: { position: "asc" } });
  const idx = siblings.findIndex((l) => l.id === lessonId);
  const swap = siblings[idx + dir];
  if (swap) {
    await db.$transaction([
      db.lesson.update({ where: { id: lesson.id }, data: { position: idx + dir } }),
      db.lesson.update({ where: { id: swap.id }, data: { position: idx } }),
    ]);
  }
  revalidateCourse(lesson.module.course.id);
}

/** Moves a lesson to a different module (appended at the end). */
export async function moveLessonToModule(formData: FormData) {
  const user = await actionAuthor();
  const lessonId = formStr(formData, "lessonId");
  const targetModuleId = formStr(formData, "moduleId");
  const lesson = await assertLessonAccess(lessonId, user);
  const target = await assertModuleAccess(targetModuleId, user);
  if (target.courseId !== lesson.module.course.id) throw new Error("Target module belongs to another course.");
  const count = await db.lesson.count({ where: { moduleId: targetModuleId } });
  await db.lesson.update({ where: { id: lessonId }, data: { moduleId: targetModuleId, position: count } });
  await normalizeLessonPositions(lesson.moduleId);
  revalidateCourse(lesson.module.course.id);
}

async function normalizeLessonPositions(moduleId: string) {
  const lessons = await db.lesson.findMany({ where: { moduleId }, orderBy: { position: "asc" } });
  await db.$transaction(lessons.map((l, i) => db.lesson.update({ where: { id: l.id }, data: { position: i } })));
}
