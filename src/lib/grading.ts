/**
 * Pure quiz grading (QUIZ-3, QUIZ-7, QUIZ-8). No I/O so it can be unit-tested in isolation.
 */
export type GradableChoice = { id: string; isCorrect: boolean };
export type GradableQuestion = {
  id: string;
  type: string; // SINGLE | MULTI | TRUE_FALSE | SHORT | ESSAY
  points: number;
  answerText: string; // SHORT: accepted answers, one per line
  choices: GradableChoice[];
};

/** Learner responses keyed by question id: a choice id, a list of choice ids, or free text. */
export type Responses = Record<string, string | string[] | undefined>;

export type GradedQuestion = {
  questionId: string;
  correct: boolean;
  response: string | string[];
  /** ESSAY answers wait for an instructor; they count toward `possible` but not `earned` yet. */
  pending: boolean;
};
export type GradeResult = { score: number; earned: number; possible: number; pending: number; perQuestion: GradedQuestion[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function isCorrectResponse(q: GradableQuestion, response: string | string[] | undefined): boolean {
  switch (q.type) {
    case "SINGLE":
    case "TRUE_FALSE": {
      const chosen = Array.isArray(response) ? response[0] : response;
      if (!chosen) return false;
      return q.choices.some((c) => c.id === chosen && c.isCorrect);
    }
    case "MULTI": {
      const chosen = new Set(Array.isArray(response) ? response : response ? [response] : []);
      const correct = new Set(q.choices.filter((c) => c.isCorrect).map((c) => c.id));
      if (chosen.size !== correct.size) return false;
      for (const id of chosen) if (!correct.has(id)) return false;
      return true;
    }
    case "SHORT": {
      const text = Array.isArray(response) ? response[0] : response;
      if (!text) return false;
      const accepted = q.answerText.split("\n").map(norm).filter(Boolean);
      return accepted.includes(norm(text));
    }
    case "ESSAY":
      return false; // never auto-correct; graded by a person
    default:
      return false;
  }
}

export function scorePct(earned: number, possible: number) {
  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}

export function grade(questions: GradableQuestion[], responses: Responses): GradeResult {
  let earned = 0;
  let possible = 0;
  let pending = 0;
  const perQuestion = questions.map((q) => {
    const response = responses[q.id] ?? "";
    possible += q.points;
    const text = Array.isArray(response) ? response[0] ?? "" : response;
    const isPending = q.type === "ESSAY" && text.trim().length > 0;
    const correct = isPending ? false : isCorrectResponse(q, response);
    if (correct) earned += q.points;
    if (isPending) pending++;
    return { questionId: q.id, correct, response, pending: isPending };
  });
  return { score: scorePct(earned, possible), earned, possible, pending, perQuestion };
}

/**
 * Re-scores an attempt after essays are graded. `pointsAwarded === null` means still pending.
 */
export function rescore(
  answers: Array<{ type: string; points: number; correct: boolean; pointsAwarded: number | null }>,
): { score: number; earned: number; possible: number; pending: number } {
  let earned = 0;
  let possible = 0;
  let pending = 0;
  for (const a of answers) {
    possible += a.points;
    if (a.type === "ESSAY") {
      if (a.pointsAwarded === null) pending++;
      else earned += Math.max(0, Math.min(a.points, a.pointsAwarded));
    } else if (a.correct) earned += a.points;
  }
  return { score: scorePct(earned, possible), earned, possible, pending };
}

/** Parses `q_<questionId>` fields from a submitted quiz form into Responses. */
export function responsesFromForm(fd: FormData, questionIds: string[]): Responses {
  const out: Responses = {};
  for (const id of questionIds) {
    const values = fd.getAll(`q_${id}`).filter((v): v is string => typeof v === "string");
    out[id] = values.length > 1 ? values : values[0];
  }
  return out;
}

// ---------- Question banks (QUIZ-9) ----------

/** Picks `count` ids at random (keeping bank order); `count <= 0` or `>= bank` returns the whole bank. */
export function drawQuestionIds(ids: string[], count: number, random: () => number = Math.random): string[] {
  if (count <= 0 || count >= ids.length) return [...ids];
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const chosen = new Set(pool.slice(0, count));
  return ids.filter((id) => chosen.has(id));
}

// ---------- Timed quizzes (QUIZ-8) ----------

export function attemptDeadline(startedAt: Date, timeLimitMin: number): Date | null {
  return timeLimitMin > 0 ? new Date(startedAt.getTime() + timeLimitMin * 60_000) : null;
}

/** A small grace period absorbs clock skew and the auto-submit round trip. */
export const DEADLINE_GRACE_MS = 15_000;

export function isExpired(deadline: Date | null | undefined, now: Date = new Date(), graceMs = DEADLINE_GRACE_MS) {
  return !!deadline && now.getTime() > deadline.getTime() + graceMs;
}
