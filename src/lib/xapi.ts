import "server-only";
import { db } from "./db";
import { appUrl } from "./mail";

/** xAPI (Tin Can) statements for learner activity. Export via the REST API or forward live to an LRS. */
export type XapiEvent = "enrollment.created" | "lesson.completed" | "course.completed" | "quiz.attempted";

type Payload = {
  event: XapiEvent;
  occurredAt: string;
  course: { id: string; slug: string; title: string };
  user: { id: string; email: string; name: string };
  lesson?: { id: string; title: string };
  quiz?: { attemptId: string; score: number; passed: boolean };
};

const VERBS: Record<XapiEvent, { id: string; display: string }> = {
  "enrollment.created": { id: "http://adlnet.gov/expapi/verbs/registered", display: "registered" },
  "lesson.completed": { id: "http://adlnet.gov/expapi/verbs/completed", display: "completed" },
  "course.completed": { id: "http://adlnet.gov/expapi/verbs/completed", display: "completed" },
  "quiz.attempted": { id: "http://adlnet.gov/expapi/verbs/answered", display: "answered" },
};

export function statementFor(event: XapiEvent, p: Payload) {
  const verb = VERBS[event];
  const isLesson = !!p.lesson && event !== "course.completed";
  const objectId = isLesson ? appUrl(`/learn/${p.course.slug}/${p.lesson!.id}`) : appUrl(`/courses/${p.course.slug}`);
  const statement: Record<string, unknown> = {
    id: undefined,
    actor: { objectType: "Agent", name: p.user.name, mbox: `mailto:${p.user.email}` },
    verb: { id: verb.id, display: { "en-US": verb.display } },
    object: {
      objectType: "Activity",
      id: objectId,
      definition: {
        name: { "en-US": isLesson ? p.lesson!.title : p.course.title },
        type: isLesson ? "http://adlnet.gov/expapi/activities/lesson" : "http://adlnet.gov/expapi/activities/course",
      },
    },
    timestamp: p.occurredAt,
  };
  if (isLesson) {
    statement.context = { contextActivities: { parent: [{ id: appUrl(`/courses/${p.course.slug}`), objectType: "Activity" }] } };
  }
  if (event === "course.completed" || event === "lesson.completed") statement.result = { completion: true };
  if (event === "quiz.attempted" && p.quiz) {
    statement.result = { score: { scaled: p.quiz.score / 100, raw: p.quiz.score, min: 0, max: 100 }, success: p.quiz.passed, completion: p.quiz.passed };
  }
  delete statement.id;
  return statement;
}

/** Forwards a statement to an LRS when XAPI_LRS_URL (+ optional XAPI_LRS_AUTH header value) is configured. */
export async function sendToLrs(statement: Record<string, unknown>) {
  const url = process.env.XAPI_LRS_URL;
  if (!url) return;
  try {
    await fetch(`${url.replace(/\/$/, "")}/statements`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-experience-api-version": "1.0.3",
        ...(process.env.XAPI_LRS_AUTH ? { authorization: process.env.XAPI_LRS_AUTH } : {}),
      },
      body: JSON.stringify(statement),
    });
  } catch (e) {
    console.error("xAPI forward failed", e);
  }
}

/** Rebuilds the statement history for a course from stored enrollments, progress and attempts. */
export async function buildCourseStatements(courseId: string) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { id: true, slug: true, title: true } });
  const enrollments = await db.enrollment.findMany({
    where: { courseId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      progress: { include: { lesson: { select: { id: true, title: true } } } },
      attempts: { include: { lesson: { select: { id: true, title: true } } } },
    },
  });
  const out: Record<string, unknown>[] = [];
  for (const e of enrollments) {
    const base = { course, user: e.user };
    out.push(statementFor("enrollment.created", { ...base, event: "enrollment.created", occurredAt: e.enrolledAt.toISOString() }));
    for (const p of e.progress) {
      out.push(statementFor("lesson.completed", { ...base, event: "lesson.completed", occurredAt: p.completedAt.toISOString(), lesson: p.lesson }));
    }
    for (const a of e.attempts) {
      out.push(
        statementFor("quiz.attempted", {
          ...base,
          event: "quiz.attempted",
          occurredAt: a.submittedAt.toISOString(),
          lesson: a.lesson,
          quiz: { attemptId: a.id, score: a.score, passed: a.passed },
        }),
      );
    }
    if (e.completedAt) out.push(statementFor("course.completed", { ...base, event: "course.completed", occurredAt: e.completedAt.toISOString() }));
  }
  return out.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}
