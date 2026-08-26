import "server-only";
import { db } from "./db";

export const questionInclude = { choices: { orderBy: { position: "asc" as const } } };

export async function getQuestions(lessonId: string) {
  return db.question.findMany({ where: { lessonId }, orderBy: { position: "asc" }, include: questionInclude });
}

/** Questions as shown to a learner: correct flags and accepted answers stripped. */
export async function getQuizForLearner(lessonId: string, shuffle: boolean) {
  const questions = await getQuestions(lessonId);
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
    orderBy: { submittedAt: "desc" },
    include: { answers: true },
  });
}

export async function getAttempt(id: string, enrollmentId: string) {
  return db.quizAttempt.findFirst({ where: { id, enrollmentId }, include: { answers: true } });
}

/** Instructor analytics for a quiz lesson (ADMIN-4). */
export async function getQuizStats(lessonId: string) {
  const [attempts, questions] = await Promise.all([
    db.quizAttempt.findMany({ where: { lessonId }, select: { score: true, passed: true, enrollmentId: true } }),
    db.question.findMany({
      where: { lessonId },
      orderBy: { position: "asc" },
      select: { id: true, prompt: true, answers: { select: { correct: true } } },
    }),
  ]);
  const learners = new Set(attempts.map((a) => a.enrollmentId));
  const passedLearners = new Set(attempts.filter((a) => a.passed).map((a) => a.enrollmentId));
  const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0;
  const perQuestion = questions
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      answered: q.answers.length,
      correctPct: q.answers.length ? Math.round((q.answers.filter((a) => a.correct).length / q.answers.length) * 100) : null,
    }))
    .sort((a, b) => (a.correctPct ?? 101) - (b.correctPct ?? 101));
  return { attemptCount: attempts.length, learnerCount: learners.size, passedCount: passedLearners.size, avgScore, perQuestion };
}
