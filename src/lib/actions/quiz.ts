"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser } from "@/lib/auth";
import { assertLessonAccess } from "@/lib/courses";
import { getQuestions, questionInclude } from "@/lib/quiz";
import { grade, responsesFromForm } from "@/lib/grading";
import { markLessonComplete } from "@/lib/actions/learning";
import { QUESTION_TYPES } from "@/lib/constants";
import { formStr } from "@/lib/validation";

function editorPath(courseId: string, lessonId: string) {
  return `/author/${courseId}/lessons/${lessonId}`;
}

async function revalidateLesson(lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { course: { select: { id: true, slug: true } } } } } });
  if (!lesson) return;
  revalidatePath(editorPath(lesson.module.course.id, lessonId));
  revalidatePath(`/learn/${lesson.module.course.slug}/${lessonId}`);
}

// ---------- Authoring ----------

export async function addQuestion(formData: FormData) {
  const user = await actionAuthor();
  const lessonId = formStr(formData, "lessonId");
  const type = formStr(formData, "type") || "SINGLE";
  if (!(QUESTION_TYPES as readonly string[]).includes(type)) throw new Error("Invalid question type");
  const lesson = await assertLessonAccess(lessonId, user);
  const count = await db.question.count({ where: { lessonId } });

  const choices =
    type === "TRUE_FALSE"
      ? [
          { text: "True", isCorrect: true, position: 0 },
          { text: "False", isCorrect: false, position: 1 },
        ]
      : type === "SHORT"
        ? []
        : [
            { text: "", isCorrect: true, position: 0 },
            { text: "", isCorrect: false, position: 1 },
            { text: "", isCorrect: false, position: 2 },
          ];

  const q = await db.question.create({
    data: { lessonId, type, prompt: "", position: count, choices: { create: choices } },
  });
  await revalidateLesson(lessonId);
  redirect(`${editorPath(lesson.module.course.id, lessonId)}#q-${q.id}`);
}

/** Saves prompt, explanation, points, choice texts and which choices are correct. */
export async function updateQuestion(formData: FormData) {
  const user = await actionAuthor();
  const questionId = formStr(formData, "questionId");
  const q = await db.question.findUnique({ where: { id: questionId }, include: questionInclude });
  if (!q) throw new Error("Question not found");
  await assertLessonAccess(q.lessonId, user);

  const points = Math.max(1, Math.min(100, Number(formStr(formData, "points")) || 1));
  const correctSingle = formStr(formData, "correct");
  const updates = q.choices.map((c) => {
    const text = formStr(formData, `choice_${c.id}`);
    const isCorrect = q.type === "MULTI" ? formData.get(`correct_${c.id}`) === "on" : correctSingle === c.id;
    return db.choice.update({ where: { id: c.id }, data: { text, isCorrect } });
  });

  await db.$transaction([
    db.question.update({
      where: { id: questionId },
      data: {
        prompt: formStr(formData, "prompt"),
        explanation: formStr(formData, "explanation"),
        answerText: formStr(formData, "answerText"),
        points,
      },
    }),
    ...updates,
  ]);
  await revalidateLesson(q.lessonId);
}

export async function addChoice(formData: FormData) {
  const user = await actionAuthor();
  await updateQuestion(formData); // keep any unsaved edits
  const questionId = formStr(formData, "questionId");
  const q = await db.question.findUnique({ where: { id: questionId }, select: { lessonId: true, _count: { select: { choices: true } } } });
  if (!q) throw new Error("Question not found");
  await assertLessonAccess(q.lessonId, user);
  await db.choice.create({ data: { questionId, text: "", isCorrect: false, position: q._count.choices } });
  await revalidateLesson(q.lessonId);
}

export async function deleteChoice(formData: FormData) {
  const user = await actionAuthor();
  await updateQuestion(formData);
  const choiceId = formStr(formData, "choiceId");
  const c = await db.choice.findUnique({ where: { id: choiceId }, select: { questionId: true, question: { select: { lessonId: true } } } });
  if (!c) throw new Error("Choice not found");
  await assertLessonAccess(c.question.lessonId, user);
  await db.choice.delete({ where: { id: choiceId } });
  await revalidateLesson(c.question.lessonId);
}

export async function deleteQuestion(formData: FormData) {
  const user = await actionAuthor();
  const questionId = formStr(formData, "questionId");
  const q = await db.question.findUnique({ where: { id: questionId }, select: { lessonId: true } });
  if (!q) throw new Error("Question not found");
  await assertLessonAccess(q.lessonId, user);
  await db.question.delete({ where: { id: questionId } });
  const rest = await db.question.findMany({ where: { lessonId: q.lessonId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((r, i) => db.question.update({ where: { id: r.id }, data: { position: i } })));
  await revalidateLesson(q.lessonId);
}

export async function moveQuestion(formData: FormData) {
  const user = await actionAuthor();
  await updateQuestion(formData);
  const questionId = formStr(formData, "questionId");
  const dir = formStr(formData, "dir") === "up" ? -1 : 1;
  const q = await db.question.findUnique({ where: { id: questionId }, select: { lessonId: true } });
  if (!q) throw new Error("Question not found");
  await assertLessonAccess(q.lessonId, user);
  const siblings = await db.question.findMany({ where: { lessonId: q.lessonId }, orderBy: { position: "asc" }, select: { id: true } });
  const idx = siblings.findIndex((s) => s.id === questionId);
  const swap = siblings[idx + dir];
  if (swap) {
    await db.$transaction([
      db.question.update({ where: { id: questionId }, data: { position: idx + dir } }),
      db.question.update({ where: { id: swap.id }, data: { position: idx } }),
    ]);
  }
  await revalidateLesson(q.lessonId);
}

// ---------- Taking a quiz ----------

export async function submitQuiz(formData: FormData) {
  const user = await actionUser();
  const lessonId = formStr(formData, "lessonId");
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { course: { select: { id: true, slug: true } } } } },
  });
  if (!lesson || lesson.type !== "QUIZ") throw new Error("Quiz not found.");
  const course = lesson.module.course;
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (!enrollment) throw new Error("You are not enrolled in this course.");

  if (lesson.maxAttempts > 0) {
    const used = await db.quizAttempt.count({ where: { enrollmentId: enrollment.id, lessonId } });
    if (used >= lesson.maxAttempts) throw new Error("No attempts remaining.");
  }

  const questions = await getQuestions(lessonId);
  const responses = responsesFromForm(formData, questions.map((q) => q.id));
  const result = grade(questions, responses);
  const passed = result.score >= lesson.passingScore;

  const attempt = await db.quizAttempt.create({
    data: {
      enrollmentId: enrollment.id,
      lessonId,
      score: result.score,
      passed,
      answers: {
        create: result.perQuestion.map((p) => ({
          questionId: p.questionId,
          response: JSON.stringify(p.response),
          correct: p.correct,
        })),
      },
    },
  });

  if (passed) await markLessonComplete(enrollment.id, lessonId, course.id); // QUIZ-4
  revalidatePath(`/learn/${course.slug}`, "layout");
  revalidatePath("/learn");
  redirect(`/learn/${course.slug}/${lessonId}?attempt=${attempt.id}`);
}
