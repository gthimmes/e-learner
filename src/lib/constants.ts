export const ROLES = ["LEARNER", "INSTRUCTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const COURSE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const LESSON_TYPES = ["TEXT", "VIDEO", "AUDIO", "IMAGE", "FILE", "QUIZ"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  TEXT: "Reading",
  VIDEO: "Video",
  AUDIO: "Audio",
  IMAGE: "Image",
  FILE: "Download",
  QUIZ: "Quiz",
};

export const LESSON_TYPE_ICONS: Record<LessonType, string> = {
  TEXT: "📄",
  VIDEO: "🎬",
  AUDIO: "🎧",
  IMAGE: "🖼️",
  FILE: "📎",
  QUIZ: "✅",
};

export const QUESTION_TYPES = ["SINGLE", "MULTI", "TRUE_FALSE", "SHORT", "ESSAY"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE: "Multiple choice (one answer)",
  MULTI: "Multiple select",
  TRUE_FALSE: "True / False",
  SHORT: "Short answer",
  ESSAY: "Essay (graded by instructor)",
};

export const COURSE_LEVELS = ["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  ALL: "All levels",
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const CATALOG_SORTS = ["newest", "popular", "rating", "title"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  newest: "Newest",
  popular: "Most popular",
  rating: "Top rated",
  title: "A → Z",
};

export const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud"] as const;

export const WEBHOOK_EVENTS = ["enrollment.created", "lesson.completed", "course.completed", "quiz.attempted", "quiz.graded"] as const;

export const SESSION_COOKIE = "el_session";
export const SESSION_DAYS = 30;

/** MIME types accepted by the upload endpoint, grouped by lesson media kind. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm"],
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  file: ["application/pdf", "text/plain", "text/markdown", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};
