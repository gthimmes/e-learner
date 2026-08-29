"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser } from "@/lib/auth";
import { assertLessonAccess, canViewCourse, isSlugTaken } from "@/lib/courses";
import { aiEnabled, aiProvider, draftLessonBody, draftOutline, generateQuestions, tutorAnswer } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { normalizeTags, formStr } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { log } from "@/lib/log";
import type { ActionState } from "./auth";

const AI_LIMIT = { calls: 40, windowMs: 60 * 60_000 };

async function guard(userId: string) {
  if (!aiEnabled) throw new Error("The AI copilot is disabled on this server.");
  const rl = await rateLimit(`ai:${userId}`, AI_LIMIT.calls, AI_LIMIT.windowMs);
  if (!rl.ok) throw new Error(`AI limit reached — try again in ${Math.ceil(rl.retryAfterSec / 60)} minute(s).`);
}

/** Drafts a whole course (modules, lessons, quiz questions) as a DRAFT the author then edits. */
export async function generateCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionAuthor();
  const topic = formStr(formData, "topic").trim().slice(0, 300);
  const audience = formStr(formData, "audience").trim().slice(0, 120);
  const modules = Math.max(1, Math.min(6, Number(formStr(formData, "modules")) || 3));
  const lessonsPerModule = Math.max(1, Math.min(6, Number(formStr(formData, "lessonsPerModule")) || 3));
  if (topic.length < 4) return { error: "Describe the course in a few words." };
  try {
    await guard(user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI unavailable" };
  }

  let outline;
  try {
    outline = await draftOutline({ topic, audience, modules, lessonsPerModule });
  } catch (e) {
    log.error("ai outline failed", { error: e instanceof Error ? e.message : String(e) });
    return { error: "The copilot could not draft an outline. Try again or write the course by hand." };
  }

  let slug = slugify(outline.title) || `course-${Date.now()}`;
  if (await isSlugTaken(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const course = await db.course.create({
    data: {
      slug,
      title: outline.title,
      summary: outline.summary,
      description: outline.description,
      tags: normalizeTags(outline.tags.join(",")),
      instructorId: user.id,
      organizationId: user.organizationId,
      modules: {
        create: outline.modules.map((m, mi) => ({
          title: m.title,
          summary: m.summary,
          position: mi,
          lessons: {
            create: m.lessons.map((l, li) => ({ title: l.title, type: l.type, body: l.body, durationMin: l.durationMin, position: li, passingScore: 70 })),
          },
        })),
      },
    },
    include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } },
  });

  // Quiz lessons get questions drawn from their module's lesson text.
  for (const m of course.modules) {
    const source = m.lessons.filter((l) => l.type !== "QUIZ").map((l) => `# ${l.title}\n\n${l.body}`).join("\n\n");
    for (const quiz of m.lessons.filter((l) => l.type === "QUIZ")) {
      try {
        const qs = await generateQuestions({ source, count: 4, courseTitle: course.title });
        for (const [i, q] of qs.entries()) {
          await db.question.create({
            data: {
              lessonId: quiz.id,
              type: q.type,
              prompt: q.prompt,
              explanation: q.explanation,
              answerText: q.answerText ?? "",
              points: q.points,
              position: i,
              choices: q.choices ? { create: q.choices.map((c, ci) => ({ text: c.text, isCorrect: c.isCorrect, position: ci })) } : undefined,
            },
          });
        }
      } catch (e) {
        log.warn("ai questions failed", { lessonId: quiz.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  await audit(user, "ai.course", { type: "course", id: course.id }, { topic, provider: aiProvider.name, modules: course.modules.length });
  revalidatePath("/author");
  redirect(`/author/${course.id}?ai=1`);
}

/** Returns a Markdown draft for a lesson body (the editor inserts it; nothing is saved here). */
export async function draftLesson(input: { lessonId: string; title: string; notes?: string }): Promise<{ body?: string; error?: string }> {
  const user = await actionAuthor();
  try {
    await guard(user.id);
    const lesson = await assertLessonAccess(input.lessonId, user);
    const course = await db.course.findUnique({ where: { id: lesson.module.course.id }, select: { title: true, level: true } });
    const body = await draftLessonBody({
      title: input.title.trim().slice(0, 120) || lesson.title,
      courseTitle: course?.title ?? "",
      moduleTitle: lesson.module.title,
      audience: course?.level && course.level !== "ALL" ? course.level.toLowerCase() + " learners" : undefined,
      notes: input.notes?.slice(0, 1000),
    });
    return { body };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI unavailable" };
  }
}

/** Generates quiz questions for a QUIZ lesson from the other lessons in its course. */
export async function generateQuizQuestions(formData: FormData) {
  const user = await actionAuthor();
  const lessonId = formStr(formData, "lessonId");
  const count = Math.max(1, Math.min(15, Number(formStr(formData, "count")) || 5));
  await guard(user.id);
  const lesson = await assertLessonAccess(lessonId, user);
  const courseId = lesson.module.course.id;
  const lessons = await db.lesson.findMany({ where: { module: { courseId }, type: { not: "QUIZ" } }, orderBy: [{ module: { position: "asc" } }, { position: "asc" }], select: { title: true, body: true } });
  const source = lessons.map((l) => `# ${l.title}\n\n${l.body}`).join("\n\n");
  if (source.trim().length < 40) throw new Error("Write some lesson content first — questions are generated from it.");
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  const qs = await generateQuestions({ source, count, courseTitle: course?.title ?? "" });
  const existing = await db.question.count({ where: { lessonId } });
  for (const [i, q] of qs.entries()) {
    await db.question.create({
      data: {
        lessonId,
        type: q.type,
        prompt: q.prompt,
        explanation: q.explanation,
        answerText: q.answerText ?? "",
        points: q.points,
        position: existing + i,
        choices: q.choices ? { create: q.choices.map((c, ci) => ({ text: c.text, isCorrect: c.isCorrect, position: ci })) } : undefined,
      },
    });
  }
  await audit(user, "ai.questions", { type: "lesson", id: lessonId }, { count: qs.length, provider: aiProvider.name });
  revalidatePath(`/author/${courseId}/lessons/${lessonId}`);
}

/** Learner tutor: grounded in the current lesson only. Stateless — the client keeps the transcript. */
export async function askTutor(input: { lessonId: string; question: string; history: Array<{ role: "user" | "assistant"; text: string }> }): Promise<{ answer?: string; error?: string }> {
  const user = await actionUser();
  const question = input.question.trim().slice(0, 1000);
  if (!question) return { error: "Ask something first." };
  try {
    await guard(user.id);
    const lesson = await db.lesson.findUnique({
      where: { id: input.lessonId },
      include: { module: { select: { course: { select: { id: true, instructorId: true, organizationId: true, status: true, coAuthors: { select: { userId: true } } } } } } },
    });
    if (!lesson || !canViewCourse(user, lesson.module.course)) return { error: "Lesson not found." };
    const enrolled = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: lesson.module.course.id } }, select: { id: true } });
    if (!enrolled && lesson.module.course.instructorId !== user.id) return { error: "Enroll in the course to use the tutor." };
    const answer = await tutorAnswer({ lessonTitle: lesson.title, lessonBody: lesson.body, question, history: input.history.slice(-8) });
    return { answer };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The tutor is unavailable right now." };
  }
}
