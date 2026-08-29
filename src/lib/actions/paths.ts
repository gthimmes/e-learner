"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser } from "@/lib/auth";
import { assertCourseAccess } from "@/lib/courses";
import { assertPathAccess, canViewPath, getPathBySlug, getPathProgress } from "@/lib/discovery";
import { firstIssue, formStr, pathSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import type { ActionState } from "./auth";

function revalidate(pathId: string, slug?: string) {
  revalidatePath("/paths");
  revalidatePath("/author/paths");
  revalidatePath(`/author/paths/${pathId}`);
  revalidatePath("/learn");
  if (slug) revalidatePath(`/paths/${slug}`);
}

function parsePath(formData: FormData) {
  const title = formStr(formData, "title");
  return pathSchema.safeParse({
    title,
    slug: formStr(formData, "slug") || slugify(title),
    summary: formStr(formData, "summary"),
    description: formStr(formData, "description"),
    coverUrl: formStr(formData, "coverUrl"),
  });
}

export async function createPath(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionAuthor();
  const parsed = parsePath(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (await db.learningPath.findUnique({ where: { slug: parsed.data.slug } })) return { error: "That slug is already in use." };
  const path = await db.learningPath.create({
    data: { ...parsed.data, coverUrl: parsed.data.coverUrl || null, createdById: user.id, organizationId: user.organizationId },
  });
  revalidate(path.id, path.slug);
  redirect(`/author/paths/${path.id}`);
}

export async function updatePath(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionAuthor();
  const pathId = formStr(formData, "pathId");
  const existing = await assertPathAccess(pathId, user);
  const parsed = parsePath(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const clash = await db.learningPath.findUnique({ where: { slug: parsed.data.slug } });
  if (clash && clash.id !== pathId) return { error: "That slug is already in use." };
  await db.learningPath.update({ where: { id: pathId }, data: { ...parsed.data, coverUrl: parsed.data.coverUrl || null } });
  revalidate(pathId, existing.slug);
  revalidate(pathId, parsed.data.slug);
  return { ok: true };
}

export async function setPathStatus(formData: FormData) {
  const user = await actionAuthor();
  const pathId = formStr(formData, "pathId");
  const status = formStr(formData, "status");
  if (!["DRAFT", "PUBLISHED"].includes(status)) throw new Error("Invalid status");
  const path = await assertPathAccess(pathId, user);
  if (status === "PUBLISHED") {
    const count = await db.learningPathItem.count({ where: { pathId } });
    if (count === 0) redirect(`/author/paths/${pathId}?error=${encodeURIComponent("Add at least one course before publishing.")}`);
  }
  await db.learningPath.update({ where: { id: pathId }, data: { status } });
  revalidate(pathId, path.slug);
  redirect(`/author/paths/${pathId}`);
}

export async function deletePath(formData: FormData) {
  const user = await actionAuthor();
  const pathId = formStr(formData, "pathId");
  const path = await assertPathAccess(pathId, user);
  await db.learningPath.delete({ where: { id: pathId } });
  revalidate(pathId, path.slug);
  redirect("/author/paths");
}

/** Adds one of the author's courses to the end of the path. */
export async function addPathCourse(formData: FormData) {
  const user = await actionAuthor();
  const pathId = formStr(formData, "pathId");
  const courseId = formStr(formData, "courseId");
  const path = await assertPathAccess(pathId, user);
  await assertCourseAccess(courseId, user);
  const count = await db.learningPathItem.count({ where: { pathId } });
  await db.learningPathItem.upsert({
    where: { pathId_courseId: { pathId, courseId } },
    update: {},
    create: { pathId, courseId, position: count },
  });
  revalidate(pathId, path.slug);
}

export async function removePathCourse(formData: FormData) {
  const user = await actionAuthor();
  const itemId = formStr(formData, "itemId");
  const item = await db.learningPathItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  const path = await assertPathAccess(item.pathId, user);
  await db.learningPathItem.delete({ where: { id: itemId } });
  const rest = await db.learningPathItem.findMany({ where: { pathId: item.pathId }, orderBy: { position: "asc" } });
  await db.$transaction(rest.map((r, i) => db.learningPathItem.update({ where: { id: r.id }, data: { position: i } })));
  revalidate(item.pathId, path.slug);
}

export async function movePathCourse(formData: FormData) {
  const user = await actionAuthor();
  const itemId = formStr(formData, "itemId");
  const dir = formStr(formData, "dir") === "up" ? -1 : 1;
  const item = await db.learningPathItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  const path = await assertPathAccess(item.pathId, user);
  const siblings = await db.learningPathItem.findMany({ where: { pathId: item.pathId }, orderBy: { position: "asc" } });
  const idx = siblings.findIndex((s) => s.id === itemId);
  const swap = siblings[idx + dir];
  if (swap) {
    await db.$transaction([
      db.learningPathItem.update({ where: { id: item.id }, data: { position: idx + dir } }),
      db.learningPathItem.update({ where: { id: swap.id }, data: { position: idx } }),
    ]);
  }
  revalidate(item.pathId, path.slug);
}

/** Learner: start (or continue) a path — records the path enrollment and goes to the next course. */
export async function startPath(formData: FormData) {
  const user = await actionUser();
  const slug = formStr(formData, "slug");
  const path = await getPathBySlug(slug);
  if (!path || !canViewPath(user, path)) throw new Error("Path not found.");
  await db.pathEnrollment.upsert({
    where: { pathId_userId: { pathId: path.id, userId: user.id } },
    update: {},
    create: { pathId: path.id, userId: user.id },
  });
  const progress = await getPathProgress(user.id, path);
  revalidate(path.id, path.slug);
  const next = progress.next;
  redirect(next ? `/courses/${next.slug}` : `/paths/${slug}`);
}
