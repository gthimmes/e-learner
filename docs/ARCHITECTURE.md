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

### Organizations, co-authors and SSO (v0.8)

- `Organization` with `User.organizationId` / `User.orgAdmin` and `Course.organizationId`. A user belongs to at most one org; courses created by org members are private to that org. `visibleCoursesWhere(user)` scopes the catalog; `canViewCourse` gates landing/enroll (404 for outsiders).
- `CourseAuthor` join for co-authors. `canEditCourse` = platform admin ∨ instructor ∨ co-author ∨ org admin of the course's org. All server actions go through `assertCourseAccess`/`assertModuleAccess`/`assertLessonAccess`, which select `accessSelect` (instructor, org, co-authors).
- **OIDC SSO** (`lib/oidc.ts`): discovery → authorization code + PKCE → ID-token verification against the IdP JWKS (`jose`), nonce/state in a signed 10-minute cookie. Users are matched/created by email; `OIDC_ORG_SLUG` auto-joins an org. `scripts/mock-oidc.mjs` is a self-contained IdP for dev and e2e.

### Interop (v0.9)

- **Versions** (`lib/versions.ts`): `CourseVersion.snapshot` stores the full course JSON (ids included). Created on every publish and on demand; `restoreVersion` upserts modules/lessons/questions by id so `LessonProgress` and `QuizAttempt` rows survive for lessons that still exist, and auto-snapshots the current state first.
- **REST API** (`app/api/v1/*`, `lib/api.ts`, `lib/apikeys.ts`): keys are `elk_…` strings stored as SHA-256 hashes; `requireApiUser` accepts a key or the session cookie and reuses the same `canViewCourse`/`canEditCourse` rules. `/api/v1/openapi.json` describes the surface.
- **Webhooks** (`lib/webhooks.ts`): `emitEvent(event, courseId, userId, extra)` is called from enroll, lesson/course completion and quiz submission. It fans out to active webhooks whose owner can edit the course, signs the body (`X-Elearner-Signature: sha256=HMAC`), logs `WebhookDelivery`, and forwards an xAPI statement to `XAPI_LRS_URL` if set. Fire-and-forget; delivery is best-effort (no retries yet).
- **xAPI** (`lib/xapi.ts`): statement builder (`registered`, `completed`, `answered` verbs with scaled scores) plus a full rebuild from stored data for export.
- **SCORM 1.2** (`lib/scorm.ts`): `jszip` package with `imsmanifest.xml`, one SCO page per lesson rendered via `remark` (same GFM + sanitize rules), bundled uploaded media, and a tiny SCORM API wrapper that sets `cmi.core.lesson_status`.

### Commerce (v1.0)

- `Course.priceCents/currency`; `Purchase` (PENDING → PAID → REFUNDED, provider session/payment ids, coupon); `Coupon` (percent off, per-course, max uses, expiry).
- **PaymentProvider** boundary (`lib/payments.ts`): `StripeProvider` (Checkout Sessions, refunds, webhook parsing) when `STRIPE_SECRET_KEY` is set, else `MockProvider` which redirects to `/checkout/mock/[purchaseId]`. `finalizePurchase` is idempotent and is reached from three places: the mock page, the Stripe webhook, and the landing page's return-from-checkout verification.
- `startCheckout` validates the coupon server-side and computes the discounted amount; a 100 % coupon or a free course enrolls immediately. `enroll` (the free path) refuses paid courses without a PAID purchase.
- Refunds (instructor action or Stripe `charge.refunded`) mark the purchase and delete the enrollment.

### Discovery (v1.1)

- `Course.tags` (comma-separated, normalised lowercase), `Course.level`, `Course.featured`. `lib/discovery.ts#searchCourses` builds a Prisma `AND` of the visibility filter, a keyword `OR` over title/summary/description/tags, tag and level filters, then sorts in memory (popular = enrollments, rating = average) and floats featured courses to the top. SQLite `contains` is a case-insensitive `LIKE`; on Postgres add `mode: "insensitive"`.
- `Review` (one per user per course, only for enrolled learners) — averages come from a single `groupBy` per page render (`ratingsFor`).
- `LearningPath` → `LearningPathItem` (ordered courses) and `PathEnrollment`. Path progress is computed from the learner's course enrollments (`getPathProgress`), which also stamps `PathEnrollment.completedAt` when every course is done. Visibility and edit rules mirror courses (`canViewPath` / `canEditPath`).

### Assessment II (v1.2)

- **Essays** (`Question.type = ESSAY`, `Question.rubric`): `grade()` marks them `pending`; the attempt is stored with `status = PENDING` and a provisional score. `gradeAnswer` writes `Answer.pointsAwarded/feedback`, `rescore()` recomputes, and when nothing is pending the attempt becomes `GRADED`, emits `quiz.graded`, and completes the lesson if it passed. Queue: `/author/[courseId]/grading`.
- **Timed quizzes / question banks** (`Lesson.timeLimitMin`, `Lesson.drawCount`): `startQuiz` creates an `IN_PROGRESS` attempt with a server-side `deadline` and the drawn `questionIds`, so reloads cannot reset the clock or redraw. `QuizTimer` (client) auto-submits at zero; the server accepts submissions within a 15 s grace and otherwise closes the attempt with a zero score (`expireAttempt`). In-progress attempts count toward `maxAttempts` and are excluded from analytics.

### Engagement (v1.3)

- `ActivityDay` (one row per user per UTC day; `visits` from lesson views, `lessons` from completions) feeds `lib/streak.ts#computeStreak` (pure, unit-tested). A streak survives until the end of a day with no activity.
- Points live on `User.points` (profile) and `Enrollment.points` (cohort leaderboards). `Badge` rows are unique per `(user, key, scope)`; `lib/engage.ts` has the catalogue and the `onLessonCompleted / onCourseCompleted / onQuizPassed / onPathCompleted / onReviewed` hooks called from the corresponding actions.
- `Notification` (in-app, bell in the nav) and `Announcement` (per course; `publishAnnouncement` fans out notifications and, when asked, email through the mail adapter).

### Operations (v1.4)

- **Webhook outbox**: `emitEvent` writes one `WebhookDelivery` row per target (`PENDING`, payload stored), attempts it immediately, and drains due retries. `attemptDelivery` applies `lib/retry.ts` — 1 m → 5 m → 30 m → 2 h → 12 h, then `DEAD`; 4xx (except 408/429) dead-letters at once. Drain from anywhere: `POST /api/cron/webhooks` (`CRON_SECRET`) or `npm run webhooks:process`. The Integrations page shows state per delivery with *Retry now*.
- **Storage**: `S3Storage` implements the same `StorageAdapter` with a self-contained SigV4 signer (`lib/s3sig.ts`, unit-tested against the AWS vectors) — works with AWS S3, MinIO and R2. `S3_PUBLIC_URL` turns `/api/media/*` into a redirect.
- **Rate limiting**: `RateLimitStore` — memory by default, Redis (`REDIS_URL`, ioredis) for multi-instance deployments, with memory fallback if Redis is unreachable.
- **Observability**: `lib/log.ts` (JSON lines in production), `src/instrumentation.ts#onRequestError` → `reportError` (optional `ERROR_REPORT_URL`), `/api/health` (db, storage, rate-limit backend, payments provider, mail transport, webhook queue depth). `AuditLog` records privileged actions (`lib/audit.ts`), shown at `/admin/audit`; `/admin/analytics` aggregates usage and outcomes.
- **Packaging**: multi-stage `Dockerfile` (migrates on start, healthcheck) and `docker-compose.yml` with Redis, MinIO and a retry scheduler.

### Copilot (v2.0)

- `lib/ai.ts` — `AiProvider` boundary: `AnthropicProvider` (Messages API over `fetch`, no SDK) or `MockProvider` (deterministic, `lib/ai-mock.ts`). Task functions `draftOutline`, `draftLessonBody`, `generateQuestions`, `summarizeLesson`, `tutorAnswer` build prompts and validate replies through `lib/ai-types.ts` (`parseJsonLoose`, `validateOutline`, `validateQuestions`) so a malformed model reply can never write bad rows.
- Actions (`actions/ai.ts`) are rate-limited per user (40/h via the rate-limit store), audited (`ai.course`, `ai.questions`), and only ever create **drafts**: `generateCourse` writes a DRAFT course with modules/lessons and quiz questions generated from each module's text; `generateQuizQuestions` appends to a quiz lesson; `draftLesson` returns Markdown for the editor to insert; `askTutor` is stateless and grounded in one lesson (enrolled learners and the author only).

### Global (v2.1)

- **Branding**: `Organization.logoUrl / primaryColor / tagline`; `lib/branding.ts#getBrand` resolves the viewer's org (or the platform default) once per request. The root layout sets `--brand` / `--brand-dark` CSS variables; primary buttons, progress bars and the nav mark use them, so a colour change re-skins the app without touching components.
- **i18n**: `lib/i18n-dict.ts` (pure catalogue, EN/ES/FR, unit-tested for key parity) + `lib/i18n.ts#getT` (cookie `el_locale`, then `Accept-Language`). Server components call `t("key", vars)`; `<html lang>` follows the locale. Course content is author-written and not translated.
- **Accessibility**: `tests/e2e/a11y.spec.ts` runs axe-core with the WCAG 2.2 A/AA rule sets over the main learner and author pages and fails on any violation; the layout provides a skip link and landmark labels.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` (cache-first for static assets, network-first with cache fallback for `/learn/*` pages, `/offline` fallback). Registered by `PwaRegister` in production only; server actions and API calls are never cached.

### Live (v2.2)

- `LiveSession` (course, optional cohort, optional lesson for the recording, join URL) with `SessionRsvp`; `OfficeHourSlot` booked by at most one learner (`updateMany … where bookedById: null` makes booking race-safe).
- `lib/ics.ts` is a pure RFC 5545 writer (folding, escaping; unit-tested); `GET /api/live/[id].ics` serves invites to enrolled learners and editors, and `createSession` emails the same invite as a `text/calendar` attachment (the mail adapter now carries attachments).
- Learners see sessions and office hours on the course page (`LiveSessions`), upcoming sessions on My Learning, and recordings inline on the pinned lesson through the existing `MediaPlayer`.

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

Deploy as a Node process (`npm run build && npm start`) or with the `Dockerfile` / `docker-compose.yml`. Stateless except for the database (SQLite volume, or Postgres by switching the Prisma provider); uploads go to S3 when `S3_BUCKET` is set; rate limits share state through Redis when `REDIS_URL` is set.

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
