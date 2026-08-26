import "server-only";
import { db } from "./db";

/** Shape stored in CourseVersion.snapshot (AUTHOR-13). Lesson/question ids are kept so restores preserve progress. */
export type CourseSnapshot = {
  title: string;
  summary: string;
  description: string;
  coverUrl: string | null;
  sequential: boolean;
  modules: Array<{
    id: string;
    title: string;
    summary: string;
    lessons: Array<{
      id: string;
      title: string;
      type: string;
      body: string;
      mediaUrl: string | null;
      mediaCaption: string;
      durationMin: number;
      passingScore: number;
      maxAttempts: number;
      shuffleQuestions: boolean;
      showAnswers: boolean;
      questions: Array<{
        id: string;
        type: string;
        prompt: string;
        explanation: string;
        answerText: string;
        points: number;
        choices: Array<{ id: string; text: string; isCorrect: boolean }>;
      }>;
    }>;
  }>;
};

export async function snapshotCourse(courseId: string): Promise<CourseSnapshot> {
  const c = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { questions: { orderBy: { position: "asc" }, include: { choices: { orderBy: { position: "asc" } } } } },
          },
        },
      },
    },
  });
  return {
    title: c.title,
    summary: c.summary,
    description: c.description,
    coverUrl: c.coverUrl,
    sequential: c.sequential,
    modules: c.modules.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        body: l.body,
        mediaUrl: l.mediaUrl,
        mediaCaption: l.mediaCaption,
        durationMin: l.durationMin,
        passingScore: l.passingScore,
        maxAttempts: l.maxAttempts,
        shuffleQuestions: l.shuffleQuestions,
        showAnswers: l.showAnswers,
        questions: l.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          explanation: q.explanation,
          answerText: q.answerText,
          points: q.points,
          choices: q.choices.map((ch) => ({ id: ch.id, text: ch.text, isCorrect: ch.isCorrect })),
        })),
      })),
    })),
  };
}

export function summarize(s: CourseSnapshot) {
  const lessons = s.modules.flatMap((m) => m.lessons);
  return { modules: s.modules.length, lessons: lessons.length, questions: lessons.reduce((n, l) => n + l.questions.length, 0) };
}

export async function createVersion(courseId: string, userId: string, note: string) {
  const snapshot = await snapshotCourse(courseId);
  const last = await db.courseVersion.findFirst({ where: { courseId }, orderBy: { number: "desc" }, select: { number: true } });
  return db.courseVersion.create({
    data: { courseId, number: (last?.number ?? 0) + 1, snapshot: JSON.stringify(snapshot), note, createdById: userId },
  });
}

export async function listVersions(courseId: string) {
  const versions = await db.courseVersion.findMany({ where: { courseId }, orderBy: { number: "desc" } });
  return versions.map((v) => ({ ...v, summary: summarize(JSON.parse(v.snapshot) as CourseSnapshot) }));
}

/**
 * Restores a snapshot into the live course. Lessons that still exist are updated in place
 * (keeping learner progress and quiz attempts); missing ones are recreated with their old ids;
 * lessons not in the snapshot are removed.
 */
export async function restoreVersion(versionId: string) {
  const v = await db.courseVersion.findUniqueOrThrow({ where: { id: versionId } });
  const s = JSON.parse(v.snapshot) as CourseSnapshot;
  const courseId = v.courseId;

  await db.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: courseId },
      data: { title: s.title, summary: s.summary, description: s.description, coverUrl: s.coverUrl, sequential: s.sequential },
    });

    const keepModules = new Set(s.modules.map((m) => m.id));
    const keepLessons = new Set(s.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    // Detach lessons we keep from modules we might delete, then delete stale modules/lessons.
    await tx.lesson.deleteMany({ where: { module: { courseId }, id: { notIn: [...keepLessons] } } });
    for (const [mi, m] of s.modules.entries()) {
      await tx.module.upsert({
        where: { id: m.id },
        create: { id: m.id, courseId, title: m.title, summary: m.summary, position: mi },
        update: { title: m.title, summary: m.summary, position: mi },
      });
    }
    await tx.module.deleteMany({ where: { courseId, id: { notIn: [...keepModules] } } });

    for (const m of s.modules) {
      for (const [li, l] of m.lessons.entries()) {
        const data = {
          moduleId: m.id,
          title: l.title,
          type: l.type,
          body: l.body,
          mediaUrl: l.mediaUrl,
          mediaCaption: l.mediaCaption,
          durationMin: l.durationMin,
          position: li,
          passingScore: l.passingScore,
          maxAttempts: l.maxAttempts,
          shuffleQuestions: l.shuffleQuestions,
          showAnswers: l.showAnswers,
        };
        await tx.lesson.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update: data });
        // Questions: replace wholesale but keep ids so answers stay linked where possible.
        const keepQ = new Set(l.questions.map((q) => q.id));
        await tx.question.deleteMany({ where: { lessonId: l.id, id: { notIn: [...keepQ] } } });
        for (const [qi, q] of l.questions.entries()) {
          const qd = { lessonId: l.id, type: q.type, prompt: q.prompt, explanation: q.explanation, answerText: q.answerText, points: q.points, position: qi };
          await tx.question.upsert({ where: { id: q.id }, create: { id: q.id, ...qd }, update: qd });
          await tx.choice.deleteMany({ where: { questionId: q.id, id: { notIn: q.choices.map((c) => c.id) } } });
          for (const [ci, c] of q.choices.entries()) {
            await tx.choice.upsert({
              where: { id: c.id },
              create: { id: c.id, questionId: q.id, text: c.text, isCorrect: c.isCorrect, position: ci },
              update: { text: c.text, isCorrect: c.isCorrect, position: ci },
            });
          }
        }
      }
    }
  });
  return v;
}
