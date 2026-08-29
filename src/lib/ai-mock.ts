/**
 * Deterministic "AI" used when no model key is configured (dev, CI, e2e). It produces the
 * same JSON shapes as the real provider from simple text heuristics, so every copilot
 * feature is exercisable offline. Pure: no I/O.
 */
import type { OutlineDraft, QuestionDraft } from "./ai-types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function mockOutline(topic: string, opts: { modules: number; lessonsPerModule: number; audience: string }): OutlineDraft {
  const t = topic.trim().replace(/[.!?]+$/, "") || "Your subject";
  const stages = ["Foundations", "Core skills", "Putting it into practice", "Going further", "Mastery"];
  const modules = Array.from({ length: Math.max(1, Math.min(opts.modules, stages.length)) }, (_, mi) => {
    const stage = stages[mi]!;
    const lessons = Array.from({ length: Math.max(1, Math.min(opts.lessonsPerModule, 6)) }, (_, li) => {
      const isQuiz = li === opts.lessonsPerModule - 1 && opts.lessonsPerModule > 1;
      const title = isQuiz ? `${stage}: knowledge check` : `${stage} ${li + 1}: ${["what it is", "why it matters", "how it works", "common mistakes", "worked example", "recap"][li % 6]}`;
      return {
        title: cap(title),
        type: (isQuiz ? "QUIZ" : "TEXT") as "TEXT" | "QUIZ",
        durationMin: isQuiz ? 5 : 6,
        body: isQuiz ? `Check what you learned in **${stage}**. You need 70% to pass.` : mockLessonBody(title, t, opts.audience),
      };
    });
    return { title: `${stage} of ${t}`, summary: `${stage} — the ${["essentials", "techniques", "real-world application", "advanced topics", "expert practice"][mi]} of ${t}.`, lessons };
  });
  return {
    title: cap(t),
    summary: `A practical introduction to ${t} for ${opts.audience || "beginners"}: ${modules.length} modules, short lessons, and a knowledge check at the end of each.`,
    description: `## What you'll learn\n\n${modules.map((m) => `- ${m.title}`).join("\n")}\n\n## Who it's for\n\n${cap(opts.audience || "Anyone curious about " + t)}.\n\n_Drafted with the e-learner copilot — review every lesson before publishing._`,
    tags: t
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
      .slice(0, 4),
    modules,
  };
}

export function mockLessonBody(title: string, topic: string, audience = "learners"): string {
  return `# ${cap(title)}

${cap(topic)} matters because it changes how ${audience} approach real problems. This lesson covers one idea and one idea only.

## Key points

1. **Start with the why.** Every part of ${topic} exists to solve a concrete problem.
2. **Build vocabulary.** Learn the three or four terms you will hear constantly.
3. **Practise in small steps.** Ten focused minutes beat an hour of skimming.

## Try it

- Explain ${topic} to a colleague in two sentences.
- Note one question you still have and bring it to the discussion below.

> Tip: revisit this lesson after the knowledge check — the questions point at what to re-read.`;
}

/** Splits text into candidate "fact" sentences for question generation. */
function facts(source: string): string[] {
  return source
    .replace(/[#>*_`\-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 220 && !/^\d/.test(s));
}

export function mockQuestions(source: string, n: number): QuestionDraft[] {
  const fs = facts(source);
  const out: QuestionDraft[] = [];
  for (let i = 0; i < n; i++) {
    const f = fs[i % Math.max(1, fs.length)] ?? `This course covers the topic in ${n} short lessons.`;
    if (i % 3 === 2) {
      out.push({ type: "TRUE_FALSE", prompt: `True or false: ${f}`, points: 1, explanation: "This statement appears in the lesson.", choices: [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }] });
    } else if (i % 3 === 1) {
      const words = f.split(" ");
      const keyword = words.find((w) => w.length > 6) ?? words[0]!;
      out.push({ type: "SHORT", prompt: `Which term from the lesson completes this: "${f.replace(keyword, "____")}"`, points: 1, explanation: `The lesson says: "${f}"`, answerText: keyword.replace(/[^a-zA-Z0-9-]/g, "") });
    } else {
      out.push({
        type: "SINGLE",
        prompt: `Which statement matches the lesson?`,
        points: 1,
        explanation: `Directly from the lesson: "${f}"`,
        choices: [
          { text: f, isCorrect: true },
          { text: "It is best to skip the fundamentals and start with advanced material.", isCorrect: false },
          { text: "The topic has no practical application.", isCorrect: false },
        ],
      });
    }
  }
  return out;
}

export function mockTutorAnswer(lessonTitle: string, lessonBody: string, question: string): string {
  const fs = facts(lessonBody);
  const q = question.toLowerCase();
  const hit = fs.find((f) => q.split(/\W+/).some((w) => w.length > 4 && f.toLowerCase().includes(w)));
  return hit
    ? `Good question. The lesson “${lessonTitle}” addresses this directly: “${hit}” In short, focus on that idea and try the practice step below the lesson.`
    : `I can only answer from “${lessonTitle}”. It does not cover that specifically — the closest point it makes is: “${fs[0] ?? "read the lesson first"}”. Try re-reading the key points, or ask your instructor in the discussion.`;
}

export function mockSummary(body: string): string {
  const fs = facts(body).slice(0, 3);
  return fs.length ? fs.map((f) => `- ${f}`).join("\n") : "- This lesson introduces one core idea and a short practice step.";
}
