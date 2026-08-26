/**
 * Pure quiz grading (QUIZ-3). No I/O so it can be unit-tested in isolation.
 */
export type GradableChoice = { id: string; isCorrect: boolean };
export type GradableQuestion = {
  id: string;
  type: string; // SINGLE | MULTI | TRUE_FALSE | SHORT
  points: number;
  answerText: string; // SHORT: accepted answers, one per line
  choices: GradableChoice[];
};

/** Learner responses keyed by question id: a choice id, a list of choice ids, or free text. */
export type Responses = Record<string, string | string[] | undefined>;

export type GradedQuestion = { questionId: string; correct: boolean; response: string | string[] };
export type GradeResult = { score: number; earned: number; possible: number; perQuestion: GradedQuestion[] };

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
    default:
      return false;
  }
}

export function grade(questions: GradableQuestion[], responses: Responses): GradeResult {
  let earned = 0;
  let possible = 0;
  const perQuestion = questions.map((q) => {
    const response = responses[q.id] ?? "";
    const correct = isCorrectResponse(q, response);
    possible += q.points;
    if (correct) earned += q.points;
    return { questionId: q.id, correct, response };
  });
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return { score, earned, possible, perQuestion };
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
