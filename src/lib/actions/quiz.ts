"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser } from "@/lib/auth";
import { assertLessonAccess } from "@/lib/courses";
import { expireAttempt, getQuestions, parseQuestionIds, questionInclude } from "@/lib/quiz";
import { attemptDeadline, drawQuestionIds, grade, isExpired, rescore, responsesFromForm } from "@/lib/grading";
import { markLessonComplete } from "@/lib/actions/learning";
import { emitEvent } from "@/lib/webhooks";
import { QUESTION_TYPES } from "@/lib/constants";
import { formStr } from "@/lib/validation";

function editorPath(courseId: string, lessonId: string) {
  return `/author/${courseId}/lessons/${lessonId}`;
}

async function revalidateLesson(lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { course: { select: { id: true, slug: true } } } } } });
  if (!lesson) return;
  revalidatePath(editorPath(lesson.module.course.id, lessonId));
  revalidatePath(`/author/${lesson.module.course.id}/grading`);
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
      : type === "SHORT" || type === "ESSAY"
        ? []
        : [
            { text: "", isCorrect: true, position: 0 },
            { text: "", isCorrect: false, position: 1 },
            { text: "", isCorrect: false, position: 2 },
          ];

  const q = await db.question.create({
    data: { lessonId, type, prompt: "", position: count, points: type === "ESSAY" ? 5 : 1, choices: { create: choices } },
  });
  await revalidateLesson(lessonId);
  redirect(`${editorPath(lesson.module.course.id, lessonId)}#q-${q.id}`);
}

/** Saves prompt, explanation, rubric, points, choice texts and which choices are correct. */
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
        rubric: formStr(formData, "rubric"),
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

async function loadQuizForLearner(lessonId: string) {
  const user = await actionUser();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { course: { select: { id: true, slug: true } } } } },
  });
  if (!lesson || lesson.type !== "QUIZ") throw new Error("Quiz not found.");
  const course = lesson.module.course;
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (!enrollment) throw new Error("You are not enrolled in this course.");
  return { user, lesson, course, enrollment, basePath: `/learn/${course.slug}/${lessonId}` };
}

/**
 * Timed quizzes and question banks start an explicit attempt (QUIZ-8/9): the deadline and the
 * drawn question ids are fixed server-side so a reload cannot reset the clock or redraw.
 */
export async function startQuiz(formData: FormData) {
  const lessonId = formStr(formData, "lessonId");
  const { lesson, enrollment, basePath } = await loadQuizForLearner(lessonId);

  const open = await db.quizAttempt.findFirst({ where: { enrollmentId: enrollment.id, lessonId, status: "IN_PROGRESS" } });
  if (open) {
    if (!isExpired(open.deadline)) redirect(`${basePath}?take=${open.id}`);
    await expireAttempt(open.id);
  }
  if (lesson.maxAttempts > 0) {
    const used = await db.quizAttempt.count({ where: { enrollmentId: enrollment.id, lessonId } });
    if (used >= lesson.maxAttempts) throw new Error("No attempts remaining.");
  }
  const bank = await db.question.findMany({ where: { lessonId }, orderBy: { position: "asc" }, select: { id: true } });
  const drawn = drawQuestionIds(bank.map((q) => q.id), lesson.drawCount);
  const startedAt = new Date();
  const attempt = await db.quizAttempt.create({
    data: {
      enrollmentId: enrollment.id,
      lessonId,
      score: 0,
      passed: false,
      status: "IN_PROGRESS",
      startedAt,
      submittedAt: startedAt,
      deadline: attemptDeadline(startedAt, lesson.timeLimitMin),
      questionIds: drawn.length === bank.length ? "" : JSON.stringify(drawn),
    },
  });
  redirect(`${basePath}?take=${attempt.id}`);
}

export async function submitQuiz(formData: FormData) {
  const lessonId = formStr(formData, "lessonId");
  const attemptId = formStr(formData, "attemptId");
  const { user, lesson, course, enrollment, basePath } = await loadQuizForLearner(lessonId);

  // Explicitly started attempt (timed / drawn) — must still be open. Late submissions inside the
  // grace window are accepted; the client auto-submits at zero, so anything later is a stale tab.
  const open = attemptId ? await db.quizAttempt.findFirst({ where: { id: attemptId, enrollmentId: enrollment.id, lessonId } }) : null;
  if (attemptId && (!open || open.status !== "IN_PROGRESS")) throw new Error("This attempt is no longer open.");
  if (open && isExpired(open.deadline)) {
    await expireAttempt(open.id);
    redirect(`${basePath}?attempt=${open.id}`);
  }
  if (!open && lesson.maxAttempts > 0) {
    const used = await db.quizAttempt.count({ where: { enrollmentId: enrollment.id, lessonId } });
    if (used >= lesson.maxAttempts) throw new Error("No attempts remaining.");
  }
  if (!open && (lesson.timeLimitMin > 0 || lesson.drawCount > 0)) throw new Error("Start the quiz first.");

  const questions = await getQuestions(lessonId, open ? parseQuestionIds(open.questionIds) : null);
  const responses = responsesFromForm(formData, questions.map((q) => q.id));
  const result = grade(questions, responses);
  const status = result.pending > 0 ? "PENDING" : "GRADED";
  const passed = status === "GRADED" && result.score >= lesson.passingScore;
  const answers = result.perQuestion.map((p) => ({ questionId: p.questionId, response: JSON.stringify(p.response), correct: p.correct }));

  const attempt = open
    ? await db.quizAttempt.update({
        where: { id: open.id },
        data: { score: result.score, passed, status, submittedAt: new Date(), answers: { create: answers } },
      })
    : await db.quizAttempt.create({
        data: { enrollmentId: enrollment.id, lessonId, score: result.score, passed, status, answers: { create: answers } },
      });

  void emitEvent("quiz.attempted", course.id, user.id, {
    lesson: { id: lesson.id, title: lesson.title },
    quiz: { attemptId: attempt.id, score: result.score, passed, pending: result.pending },
  });
  if (passed) await markLessonComplete(enrollment.id, lessonId, course.id); // QUIZ-4
  revalidatePath(`/learn/${course.slug}`, "layout");
  revalidatePath("/learn");
  revalidatePath(`/author/${course.id}/grading`);
  redirect(`${basePath}?attempt=${attempt.id}`);
}

// ---------- Manual grading (QUIZ-7) ----------

/** Instructor awards points + feedback for one essay answer; the attempt is re-scored when nothing is pending. */
export async function gradeAnswer(formData: FormData) {
  const user = await actionAuthor();
  const answerId = formStr(formData, "answerId");
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    include: {
      question: { select: { id: true, lessonId: true, points: true, type: true } },
      attempt: { include: { lesson: { select: { id: true, title: true, passingScore: true, module: { select: { course: { select: { id: true, slug: true } } } } } }, enrollment: { select: { id: true, userId: true } } } },
    },
  });
  if (!answer || answer.question.type !== "ESSAY") throw new Error("Answer not found.");
  await assertLessonAccess(answer.question.lessonId, user);
  const points = Math.max(0, Math.min(answer.question.points, Math.round(Number(formStr(formData, "points")) || 0)));
  await db.answer.update({
    where: { id: answerId },
    data: { pointsAwarded: points, feedback: formStr(formData, "feedback").slice(0, 5000), gradedAt: new Date(), correct: points * 2 >= answer.question.points },
  });

  const all = await db.answer.findMany({ where: { attemptId: answer.attemptId }, include: { question: { select: { type: true, points: true } } } });
  const r = rescore(all.map((a) => ({ type: a.question.type, points: a.question.points, correct: a.correct, pointsAwarded: a.pointsAwarded })));
  const lesson = answer.attempt.lesson;
  const course = lesson.module.course;
  const status = r.pending > 0 ? "PENDING" : "GRADED";
  const passed = status === "GRADED" && r.score >= lesson.passingScore;
  await db.quizAttempt.update({ where: { id: answer.attemptId }, data: { score: r.score, passed, status } });

  if (status === "GRADED") {
    void emitEvent("quiz.graded", course.id, answer.attempt.enrollment.userId, {
      lesson: { id: lesson.id, title: lesson.title },
      quiz: { attemptId: answer.attemptId, score: r.score, passed, pending: 0 },
    });
    if (passed) await markLessonComplete(answer.attempt.enrollment.id, lesson.id, course.id);
  }
  revalidatePath(`/author/${course.id}/grading`);
  revalidatePath(`/author/${course.id}`, "layout");
  revalidatePath(`/learn/${course.slug}`, "layout");
  revalidatePath("/learn");
}
