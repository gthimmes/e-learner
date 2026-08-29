import { z } from "zod";
import { COURSE_LEVELS, CURRENCIES, LESSON_TYPES, QUESTION_TYPES } from "./constants";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const courseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers and hyphens")
    .max(80),
  summary: z.string().trim().max(300).default(""),
  description: z.string().max(50_000).default(""),
  coverUrl: z.string().trim().max(500).default(""),
  sequential: z.boolean().default(false),
  priceCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
  currency: z.enum(CURRENCIES).default("usd"),
  tags: z.string().max(300).default("").transform(normalizeTags),
  level: z.enum(COURSE_LEVELS).default("ALL"),
});

/** "Data Science, python,Python , " -> "data-science,python" (max 10 tags, 30 chars each). */
export function normalizeTags(input: string) {
  const seen = new Set<string>();
  for (const raw of input.split(/[,\n]/)) {
    const t = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    if (t) seen.add(t);
    if (seen.size >= 10) break;
  }
  return [...seen].join(",");
}

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Pick a star rating").max(5),
  body: z.string().trim().max(2000).default(""),
});

export const pathSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers and hyphens")
    .max(80),
  summary: z.string().trim().max(300).default(""),
  description: z.string().max(50_000).default(""),
  coverUrl: z.string().trim().max(500).default(""),
});

/** "12.50" → 1250 cents; blank/invalid → 0. */
export function parsePriceCents(s: string) {
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export const moduleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  summary: z.string().trim().max(500).default(""),
});

export const lessonSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  type: z.enum(LESSON_TYPES),
  body: z.string().max(200_000).default(""),
  mediaUrl: z.string().trim().max(1000).default(""),
  mediaCaption: z.string().trim().max(300).default(""),
  durationMin: z.coerce.number().int().min(0).max(24 * 60).default(5),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(0).max(100).default(0),
  shuffleQuestions: z.boolean().default(false),
  showAnswers: z.boolean().default(true),
  timeLimitMin: z.coerce.number().int().min(0).max(24 * 60).default(0),
  drawCount: z.coerce.number().int().min(0).max(500).default(0),
});

export const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().min(1, "Question text is required").max(5000),
  explanation: z.string().trim().max(5000).default(""),
  answerText: z.string().trim().max(2000).default(""),
  points: z.coerce.number().int().min(1).max(100).default(1),
  choices: z
    .array(z.object({ text: z.string().trim().max(500), isCorrect: z.boolean() }))
    .default([]),
});

/** Reads a checkbox from FormData ("on" / "true" / "1" → true). */
export function formBool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function formStr(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}
