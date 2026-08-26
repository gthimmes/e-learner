import { z } from "zod";
import { LESSON_TYPES, QUESTION_TYPES } from "./constants";

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
});

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
