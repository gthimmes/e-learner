import "server-only";
import { db } from "./db";

export const questionInclude = { choices: { orderBy: { position: "asc" as const } } };

/** Questions of a lesson in position order; `ids` restricts to a drawn subset (QUIZ-9). */
export async function getQuestions(lessonId: string, ids?: string[] | null) {
  return db.question.findMany({
    where: ids && ids.length ? { lessonId, id: { in: ids } } : { lessonId },
    orderBy: { position: "asc" },
    include: questionInclude,
  });
}

/** `QuizAttempt.questionIds` is a JSON array, or "" for "all questions". */
export function parseQuestionIds(s: string | null | undefined): string[] | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) && v.length ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

/** Questions as shown to a learner: correct flags, accepted answers and rubrics stripped. */
export async function getQuizForLearner(lessonId: string, shuffle: boolean, ids?: string[] | null) {
  const questions = await getQuestions(lessonId, ids);
  const safe = questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    position: q.position,
    choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
  }));
  if (shuffle) {
    for (let i = safe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [safe[i], safe[j]] = [safe[j]!, safe[i]!];
    }
  }
  return safe;
}

export async function getAttempts(enrollmentId: string, lessonId: string) {
  return db.quizAttempt.findMany({
    where: { enrollmentId, lessonId },
    orderBy: { startedAt: "desc" },
    include: { answers: true },
  });
}

export async function getAttempt(id: string, enrollmentId: string) {
  return db.quizAttempt.findFirst({ where: { id, enrollmentId }, include: { answers: true } });
}

/** An attempt whose time ran out with no submission is closed with a zero score (it still uses up an attempt). */
export async function expireAttempt(attemptId: string) {
  return db.quizAttempt.update({
    where: { id: attemptId },
    data: { status: "GRADED", score: 0, passed: false, submittedAt: new Date() },
  });
}

/** Instructor analytics for a quiz lesson (ADMIN-4). In-progress attempts are ignored. */
export async function getQuizStats(lessonId: string) {
  const [attempts, questions] = await Promise.all([
    db.quizAttempt.findMany({ where: { lessonId, status: { not: "IN_PROGRESS" } }, select: { score: true, passed: true, enrollmentId: true, status: true } }),
    db.question.findMany({
      where: { lessonId },
      orderBy: { position: "asc" },
      select: { id: true, prompt: true, answers: { select: { correct: true }, where: { attempt: { status: { not: "IN_PROGRESS" } } } } },
    }),
  ]);
  const learners = new Set(attempts.map((a) => a.enrollmentId));
  const passedLearners = new Set(attempts.filter((a) => a.passed).map((a) => a.enrollmentId));
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;
  const pendingCount = attempts.filter((a) => a.status === "PENDING").length;
  const perQuestion = questions
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      answered: q.answers.length,
      correctPct: q.answers.length ? Math.round((q.answers.filter((a) => a.correct).length / q.answers.length) * 100) : null,
    }))
    .sort((a, b) => (a.correctPct ?? 101) - (b.correctPct ?? 101));
  return { attemptCount: attempts.length, learnerCount: learners.size, passedCount: passedLearners.size, avgScore, pendingCount, perQuestion };
}

// ---------- Manual grading queue (QUIZ-7) ----------

export async function countPendingGrading(courseId: string) {
  return db.quizAttempt.count({ where: { status: "PENDING", lesson: { module: { courseId } } } });
}

/** Attempts with essay answers awaiting a grade, oldest first. */
export async function getPendingGrading(courseId: string) {
  const attempts = await db.quizAttempt.findMany({
    where: { status: "PENDING", lesson: { module: { courseId } } },
    orderBy: { submittedAt: "asc" },
    include: {
      lesson: { select: { id: true, title: true, passingScore: true } },
      enrollment: { include: { user: { select: { id: true, name: true, email: true } } } },
      answers: { include: { question: { select: { id: true, type: true, prompt: true, points: true, rubric: true, position: true } } } },
    },
  });
  return attempts.map((a) => ({
    ...a,
    essays: a.answers.filter((ans) => ans.question.type === "ESSAY").sort((x, y) => x.question.position - y.question.position),
  }));
}
