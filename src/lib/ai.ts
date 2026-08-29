import "server-only";
import { log } from "./log";
import { mockLessonBody, mockOutline, mockQuestions, mockSummary, mockTutorAnswer } from "./ai-mock";
import { parseJsonLoose, validateOutline, validateQuestions, type OutlineDraft, type QuestionDraft } from "./ai-types";

/**
 * Model provider boundary (v2.0). `AnthropicProvider` talks to the Messages API directly (no SDK);
 * `MockProvider` is deterministic and used whenever `ANTHROPIC_API_KEY` is unset (dev, CI, e2e).
 */
export interface AiProvider {
  readonly name: "anthropic" | "mock";
  complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}

class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  constructor(
    private apiKey: string,
    private model: string,
  ) {}
  async complete({ system, prompt, maxTokens = 4000 }: { system: string; prompt: string; maxTokens?: number }) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90_000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Model API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
      if (!text) throw new Error("Empty model reply");
      return text;
    } finally {
      clearTimeout(t);
    }
  }
}

class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  async complete() {
    throw new Error("MockProvider does not do free-form completion");
    return "";
  }
}

export const aiProvider: AiProvider = process.env.ANTHROPIC_API_KEY ? new AnthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.AI_MODEL || "claude-sonnet-5") : new MockProvider();
export const aiEnabled = process.env.AI_DISABLED !== "1";
const isMock = () => aiProvider.name === "mock";

const STYLE = "You are the e-learner course copilot. Write for online learners: plain language, short paragraphs, concrete examples. Never invent citations. Reply with JSON only when asked for JSON.";

// ---------- Authoring ----------

export async function draftOutline(input: { topic: string; audience: string; modules: number; lessonsPerModule: number }): Promise<OutlineDraft> {
  if (isMock()) return mockOutline(input.topic, input);
  const prompt = `Design an online course.
Topic: ${input.topic}
Audience: ${input.audience || "beginners"}
Structure: ${input.modules} modules × ${input.lessonsPerModule} lessons; make the last lesson of each module a QUIZ.
Return JSON: {"title","summary"(<=300 chars),"description"(markdown: what you'll learn, who it's for),"tags"(<=5 lowercase),"modules":[{"title","summary","lessons":[{"title","type":"TEXT"|"QUIZ","durationMin","body"(full markdown lesson, 250-500 words; for QUIZ a one-line instruction)}]}]}`;
  const text = await aiProvider.complete({ system: STYLE, prompt, maxTokens: 8000 });
  return validateOutline(parseJsonLoose(text));
}

export async function draftLessonBody(input: { title: string; courseTitle: string; moduleTitle: string; audience?: string; notes?: string }): Promise<string> {
  if (isMock()) return mockLessonBody(input.title, input.courseTitle, input.audience);
  const prompt = `Write the lesson "${input.title}" for the course "${input.courseTitle}" (module "${input.moduleTitle}").${input.notes ? ` Author notes: ${input.notes}` : ""}
Markdown, 300-600 words, one idea, with a "Key points" list and a short "Try it" exercise. Return markdown only.`;
  return (await aiProvider.complete({ system: STYLE, prompt, maxTokens: 3000 })).trim();
}

export async function generateQuestions(input: { source: string; count: number; courseTitle: string }): Promise<QuestionDraft[]> {
  if (isMock()) return mockQuestions(input.source, input.count);
  const prompt = `From the lesson material below, write ${input.count} quiz questions for "${input.courseTitle}". Mix types SINGLE (one correct of 3-4), MULTI (2+ correct of 4), TRUE_FALSE, SHORT (one-word/short answer with "answerText"). Every question must be answerable from the material; distractors must be plausible.
Return JSON: {"questions":[{"type","prompt","points":1,"explanation","choices":[{"text","isCorrect"}],"answerText"}]}

MATERIAL:
${input.source.slice(0, 24_000)}`;
  const text = await aiProvider.complete({ system: STYLE, prompt, maxTokens: 4000 });
  return validateQuestions(parseJsonLoose(text), input.count);
}

export async function summarizeLesson(body: string): Promise<string> {
  if (isMock()) return mockSummary(body);
  const text = await aiProvider.complete({ system: STYLE, prompt: `Summarise this lesson in 3 bullet points (markdown list only):\n\n${body.slice(0, 20_000)}`, maxTokens: 400 });
  return text.trim();
}

// ---------- Learner tutor ----------

export async function tutorAnswer(input: { lessonTitle: string; lessonBody: string; question: string; history: Array<{ role: "user" | "assistant"; text: string }> }): Promise<string> {
  if (isMock()) return mockTutorAnswer(input.lessonTitle, input.lessonBody, input.question);
  const transcript = input.history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.text}`)
    .join("\n");
  const prompt = `You are a patient tutor for the lesson "${input.lessonTitle}". Answer ONLY from the lesson below; if the lesson does not cover it, say so and suggest asking the instructor. Keep answers under 150 words. Do not give away quiz answers verbatim; explain the reasoning.

LESSON:
${input.lessonBody.slice(0, 20_000)}

${transcript ? `CONVERSATION SO FAR:\n${transcript}\n` : ""}
Learner: ${input.question}
Tutor:`;
  const text = await aiProvider.complete({ system: STYLE, prompt, maxTokens: 600 });
  log.info("ai tutor", { lesson: input.lessonTitle, chars: text.length });
  return text.trim();
}
