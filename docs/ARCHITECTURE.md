# Architecture — e-learner

## Overview

e-learner is a single **Next.js (App Router) application** that serves both the authoring
and learning experiences, backed by a relational database through **Prisma**. It is
deliberately a modular monolith: one deployable, clear internal boundaries, and adapters
for the things that vary between laptop and production (database, file storage, email).

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│  React Server Components (read)  ·  Server Actions (mutate)      │
└───────────────┬──────────────────────────────────┬───────────────┘
                │                                  │
┌───────────────▼──────────────────────────────────▼───────────────┐
│  Next.js app (src/app)                                            │
│  ├─ (public)  /            catalog, course landing, sign-in/up    │
│  ├─ (learn)   /learn/...   my learning, course player             │
│  ├─ (author)  /author/...  instructor dashboard, course editor    │
│  ├─ (admin)   /admin/...   users & roles                          │
│  └─ api/      /api/upload, /api/media/[key]  (route handlers)     │
├───────────────────────────────────────────────────────────────────┤
│  Domain layer (src/lib)                                           │
│  auth · courses · lessons · enrollment · progress · quiz (P2)     │
│  Every mutation is a server action that (1) checks session,       │
│  (2) validates with zod, (3) authorizes, (4) writes via Prisma.   │
├──────────────┬─────────────────────────┬──────────────────────────┤
│  Prisma ORM  │  Storage adapter        │  Mail adapter (P3)       │
│  SQLite (dev)│  local disk (dev)       │  console (dev)           │
│  Postgres    │  S3-compatible (prod)   │  SMTP / provider (prod)  │
└──────────────┴─────────────────────────┴──────────────────────────┘
```

## Technology choices

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, React 19, TypeScript | One codebase for UI + server; RSC keeps data access on the server; server actions give CSRF-safe mutations without an API layer to maintain |
| Styling | Tailwind CSS 4 | Fast to iterate, no runtime CSS, easy theming later |
| Data | Prisma 6 + SQLite (dev) / PostgreSQL (prod) | Type-safe queries; the same schema runs on both engines; zero-setup local dev (NFR-1, NFR-2) |
| Auth | Own credentials auth: bcrypt + `jose` signed JWT in an HTTP-only cookie | Small, auditable, no third-party lock-in; swappable for OIDC in Phase 3 |
| Content | Markdown (GFM) rendered with `react-markdown` + `rehype-sanitize` | "Writing beats configuring"; sanitization prevents stored XSS (NFR-3) |
| Media | Uploads via route handler → `StorageAdapter`; external video via YouTube / Vimeo embed | Local disk in dev, S3 in prod, same interface |
| Validation | zod | Shared schemas for forms and actions |

## Domain model

```
User ──< Course (instructor)
User ──< Enrollment >── Course
Course ──< Module ──< Lesson
Enrollment ──< LessonProgress >── Lesson
Lesson ──< Question ──< Choice            (Phase 2)
Enrollment ──< QuizAttempt ──< Answer     (Phase 2)
```

| Entity | Key fields | Notes |
| --- | --- | --- |
| `User` | email (unique), passwordHash, role `LEARNER \| INSTRUCTOR \| ADMIN` | First user bootstraps as ADMIN |
| `Course` | slug (unique), title, summary, description (md), coverUrl, status `DRAFT \| PUBLISHED \| ARCHIVED`, instructorId | Only PUBLISHED courses appear in the catalog |
| `Module` | courseId, title, position | Ordered by `position` |
| `Lesson` | moduleId, title, position, type `TEXT \| VIDEO \| AUDIO \| IMAGE \| FILE \| QUIZ`, body (md), mediaUrl, durationMin | `mediaUrl` is an uploaded key or an external URL |
| `Enrollment` | userId + courseId (unique), enrolledAt, completedAt, lastLessonId | `completedAt` set when all lessons are done |
| `LessonProgress` | enrollmentId + lessonId (unique), completedAt | Source of truth for progress % |
| `Question` / `Choice` | lessonId, type, prompt, position; choice text + isCorrect | Phase 2 |
| `QuizAttempt` / `Answer` | enrollmentId, lessonId, score, passed; per-question answer | Phase 2 |
| `Cohort` | courseId, name, startsAt, endsAt, dueAt; `Enrollment.cohortId` | Phase 3 — due dates drive overdue flags and reminders |
| `Comment` | lessonId, userId, parentId (one level), body, deletedAt | Phase 3 — soft-deleted; instructor/admin moderate |
| `PasswordReset` | userId, tokenHash (sha256), expiresAt, usedAt | Phase 3 — single-use, 60-minute TTL |

### Phase 3 adapters and safeguards

- **Mail adapter** (`lib/mail.ts`): `ConsoleMailer` in dev, `SmtpMailer` (nodemailer) when `SMTP_URL` is set. Used by password reset and `scripts/send-reminders.ts` (cron-able).
- **Rate limiting** (`lib/ratelimit.ts`): fixed-window, in-memory, keyed by IP (+ email) for sign-in and reset requests. Per-process — move the store to Redis when running more than one instance.
- **CI** (`.github/workflows/ci.yml`): migrate → seed → lint → typecheck → unit → build → Playwright e2e against `next start`.

Progress % = completed lessons / total lessons in the course, computed on read (cheap at
Phase 1 scale; denormalize into `Enrollment.progressPct` if NFR-7 demands it).

## Request flow examples

**Instructor publishes a course**
1. `PublishButton` (client) calls server action `publishCourse(courseId)`.
2. Action loads session from cookie → `requireRole('INSTRUCTOR' | 'ADMIN')`.
3. Verifies `course.instructorId === user.id || user.role === 'ADMIN'`.
4. Validates course has ≥ 1 lesson; sets `status = PUBLISHED`; `revalidatePath('/')`.

**Learner completes a lesson**
1. `MarkComplete` calls `completeLesson(lessonId)`.
2. Action resolves enrollment for (user, lesson.course) or throws.
3. Upserts `LessonProgress`; updates `Enrollment.lastLessonId`.
4. If every lesson in the course now has progress → sets `Enrollment.completedAt`.
5. Returns the next lesson id; client navigates.

**Media upload**
1. `POST /api/upload` (multipart) → session check → MIME + size validation.
2. `storage.put(key, bytes)` (local: `./uploads/<key>`; prod: S3).
3. Returns `{ url: '/api/media/<key>' }`; author pastes/attaches it to the lesson.
4. `GET /api/media/[key]` streams the object (local) or 302s to a signed URL (S3).

## Authorization matrix

| Action | Learner | Instructor | Admin |
| --- | --- | --- | --- |
| Browse catalog, enroll, take courses | ✓ | ✓ | ✓ |
| Create course | | ✓ | ✓ |
| Edit / publish course | | own | any |
| View course learners' progress | | own | any |
| Manage users & roles | | | ✓ |

Enforced in the domain layer (`src/lib/auth.ts` helpers), never only in the UI.

## Project layout

```
src/
  app/                     routes (see overview)
  components/              shared UI (nav, markdown renderer, media players, forms)
  lib/
    db.ts                  Prisma client singleton
    auth.ts                session cookie, password hashing, requireUser/requireRole
    storage.ts             StorageAdapter interface + local implementation
    courses.ts             queries + server actions for courses/modules/lessons
    learning.ts            enrollment + progress queries/actions
    quiz.ts                (Phase 2) question CRUD + grading
    validation.ts          zod schemas
prisma/
  schema.prisma
  seed.ts                  demo instructor, learner, and a sample course
docs/                      vision, requirements, roadmap, this file
uploads/                   local media (git-ignored)
```

## Environment & deployment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Prisma connection (switch provider to `postgresql` for prod) |
| `SESSION_SECRET` | dev value | HMAC key for session JWTs — **must** be set in prod |
| `UPLOAD_DIR` | `./uploads` | Local storage root |
| `MAX_UPLOAD_MB` | `200` | Upload size limit |

Deploy as a Node process (`npm run build && npm start`) or a container. Stateless except
for `uploads/` (use S3 adapter in prod) and the database.

## Phase 2 / 3 extension points

- **Quiz engine:** `Lesson.type = QUIZ` + `Question`/`Choice`; grading is a pure function
  `grade(questions, answers) → {score, passed, perQuestion}` so it is unit-testable.
- **Gating:** `isLessonUnlocked(enrollment, lesson)` in `learning.ts`; the player already
  routes every navigation through it (returns `true` in Phase 1).
- **Storage:** implement `S3Storage` against the same `StorageAdapter` interface.
- **Multi-tenancy:** add `organizationId` to `User` and `Course`; all queries already go
  through `lib/*` so the scoping change is localized.
- **Auth providers:** `auth.ts` exposes `createSession(userId)`; an OIDC callback route
  can call it after external verification.
