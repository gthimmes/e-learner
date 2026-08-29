/** Shapes exchanged with the model provider (real or mock). */

export type LessonDraft = { title: string; type: "TEXT" | "QUIZ"; durationMin: number; body: string };
export type ModuleDraft = { title: string; summary: string; lessons: LessonDraft[] };
export type OutlineDraft = { title: string; summary: string; description: string; tags: string[]; modules: ModuleDraft[] };

export type QuestionDraft = {
  type: "SINGLE" | "MULTI" | "TRUE_FALSE" | "SHORT";
  prompt: string;
  points: number;
  explanation: string;
  answerText?: string;
  choices?: Array<{ text: string; isCorrect: boolean }>;
};

/** Pulls the first JSON object/array out of a model reply that may include prose or code fences. */
export function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : text;
  const start = Math.min(...[candidate.indexOf("{"), candidate.indexOf("[")].filter((i) => i >= 0));
  if (!Number.isFinite(start)) throw new Error("No JSON in model reply");
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

export function validateOutline(raw: unknown): OutlineDraft {
  const o = raw as Partial<OutlineDraft>;
  if (!o || typeof o.title !== "string" || !Array.isArray(o.modules) || o.modules.length === 0) throw new Error("Outline is missing a title or modules");
  return {
    title: o.title.trim().slice(0, 120),
    summary: (o.summary ?? "").toString().trim().slice(0, 300),
    description: (o.description ?? "").toString().slice(0, 20_000),
    tags: Array.isArray(o.tags) ? o.tags.map(String).slice(0, 10) : [],
    modules: o.modules.slice(0, 12).map((m) => ({
      title: String(m?.title ?? "Module").trim().slice(0, 120),
      summary: String(m?.summary ?? "").trim().slice(0, 500),
      lessons: (Array.isArray(m?.lessons) ? m.lessons : []).slice(0, 12).map((l) => ({
        title: String(l?.title ?? "Lesson").trim().slice(0, 120),
        type: l?.type === "QUIZ" ? "QUIZ" : "TEXT",
        durationMin: Math.max(1, Math.min(120, Math.round(Number(l?.durationMin) || 5))),
        body: String(l?.body ?? "").slice(0, 50_000),
      })),
    })),
  };
}

export function validateQuestions(raw: unknown, max = 20): QuestionDraft[] {
  const arr = Array.isArray(raw) ? raw : (raw as { questions?: unknown[] })?.questions;
  if (!Array.isArray(arr)) throw new Error("Questions are not a list");
  const out: QuestionDraft[] = [];
  for (const q of arr.slice(0, max) as Array<Partial<QuestionDraft>>) {
    const type = (["SINGLE", "MULTI", "TRUE_FALSE", "SHORT"] as const).find((t) => t === q?.type) ?? "SINGLE";
    const prompt = String(q?.prompt ?? "").trim();
    if (!prompt) continue;
    const choices = Array.isArray(q?.choices) ? q.choices.map((c) => ({ text: String(c?.text ?? "").trim(), isCorrect: !!c?.isCorrect })).filter((c) => c.text) : [];
    if (type !== "SHORT" && (choices.length < 2 || !choices.some((c) => c.isCorrect))) continue;
    out.push({
      type,
      prompt: prompt.slice(0, 2000),
      points: Math.max(1, Math.min(20, Math.round(Number(q?.points) || 1))),
      explanation: String(q?.explanation ?? "").slice(0, 2000),
      answerText: type === "SHORT" ? String(q?.answerText ?? "").slice(0, 500) : undefined,
      choices: type === "SHORT" ? undefined : choices.slice(0, 8),
    });
  }
  return out;
}
