# Roadmap — e-learner

Requirement IDs reference [REQUIREMENTS.md](./REQUIREMENTS.md). Each phase ends in a
shippable release; nothing in a later phase is a prerequisite for using an earlier one.

**Status (2026-08-28):** Phases 1–3 ✅ shipped (v0.1–v1.0: authoring, media, learning,
quizzes, gating, certificates, cohorts, discussion, orgs, SSO, versions, REST API, webhooks,
xAPI, SCORM, payments). Phase 4 🔨 in progress — v1.1 ✅ (catalog search, tags/levels, sort, featured,
ratings & reviews, learning paths, API search + paths). Tests: unit, HTTP smoke, Playwright e2e (main flow, password reset, SSO, commerce).

## North-star goals (Phases 4–5)

These are deliberately ambitious. Each one is measurable and each milestone below moves at
least one of them.

| # | Goal | Measure |
| --- | --- | --- |
| G1 | **Zero-to-course in 15 minutes** | A new instructor publishes a 10-lesson course with a passing quiz in ≤ 15 min, with AI drafting the outline and questions |
| G2 | **Learners come back** | 7-day return rate ≥ 40 % driven by streaks, badges, reminders and learning paths |
| G3 | **Any content, any question type** | Auto-graded *and* human-graded assessment (essays), timed exams, question banks |
| G4 | **Runs anywhere, plugs into anything** | One container on Postgres + S3 + Redis; SCORM/xAPI/REST/webhooks with retries; 10 k concurrent learners on a single instance |
| G5 | **Accessible and global** | WCAG 2.2 AA on every learner surface; UI strings translatable; per-org branding and domains |
| G6 | **Nothing ships unverified** | Every milestone adds e2e coverage; CI green on every push; a recorded product demo per release |

## Phase 1 — Learn (v0.1 → v0.3) · *content courses end-to-end*

**Goal:** an instructor can author a course from text, images, audio and video and a learner
can enroll, work through it and see their progress.

| Milestone | Scope | Requirements |
| --- | --- | --- |
| **v0.1 Foundation** | App scaffold, data model, auth (register / login / roles, first user = admin), base layout | AUTH-1..5, NFR-1, NFR-4 |
| **v0.2 Author** | Instructor dashboard; create/edit course; modules & lessons with ordering; lesson types TEXT / VIDEO / AUDIO / IMAGE / FILE; Markdown editor with preview; media upload via storage adapter; publish / unpublish | AUTHOR-1..9, ADMIN-1, NFR-3 |
| **v0.3 Learn** | Public catalog; enrollment; course player with outline + lesson view; complete / next / previous; My Learning dashboard with resume; course completion; per-course learner progress list; admin user & role management | LEARN-1..7, ADMIN-2, ADMIN-3, NFR-5 |

**Exit criteria:** seed data demo course runs on a clean checkout with `npm run dev`; a new
user can go from sign-up to published course in under 30 minutes; Lighthouse accessibility
score ≥ 90 on catalog and player.

## Phase 2 — Assess (v0.4 → v0.6) · *prove learning happened*

**Goal:** courses can contain quizzes that gate completion and issue certificates.

| Milestone | Scope | Requirements |
| --- | --- | --- |
| **v0.4 Quizzes** | `QUIZ` lesson type; question editor (multiple choice, multi-select, true/false, short answer); quiz settings (passing score, attempts, shuffle, reveal answers); learner attempt flow with auto-grading; attempt history and best score | AUTHOR-10, QUIZ-1..6 |
| **v0.5 Gating & structure** | Sequential courses (lock until prior lesson done); quiz must pass to complete; media playback position memory; direct / CSV enrollment by instructors | AUTHOR-11, LEARN-8, LEARN-9, LEARN-11 |
| **v0.6 Outcomes** | Completion certificates (PDF); per-quiz analytics (average score, hardest questions); CSV export of progress and grades | LEARN-10, ADMIN-4, ADMIN-5 |

**Exit criteria:** a course with a final quiz cannot be completed without passing it; an
instructor can identify the three hardest questions in any quiz from the dashboard.

## Phase 3 — Scale (v0.7 → v1.0) · *many courses, many orgs*

**Goal:** run e-learner as a shared service for multiple organizations.

| Milestone | Scope | Requirements |
| --- | --- | --- |
| **v0.7 Cohorts & community** | Cohorts with start / end / due dates; reminders by email; per-lesson discussion threads | LEARN-12, LEARN-13, AUTH-6 |
| **v0.8 Organizations** | Multi-tenant orgs with isolated catalogs and admins; co-authors; SSO (OIDC) | ADMIN-6, AUTHOR-12, AUTH-7 |
| **v0.9 Interop** | Course versioning; SCORM / xAPI statement export; public REST API + webhooks | AUTHOR-13 |
| **v1.0 Commerce** | Paid courses (Stripe), coupons, refunds; hosted offering | — |

## Phase 4 — Delight (v1.1 → v1.4) · *learners choose it, operators trust it*

**Goal:** turn a complete LMS into one people prefer: discoverable content, richer
assessment, habit-forming engagement, and production-grade operations.

| Milestone | Scope | Goals |
| --- | --- | --- |
| **v1.1 Discover** | Catalog search, tags and levels, sort by popularity / rating; ratings & reviews; **learning paths** (ordered course bundles with path progress); API exposes search + ratings | G2 |
| **v1.2 Assess II** | Essay questions with an instructor grading queue and rubric feedback; timed quizzes with auto-submit; question banks with random draw; attempt review with per-question feedback | G3 |
| **v1.3 Engage** | Learner profile; daily streaks and badges (first lesson, course complete, quiz ace, 7-day streak); cohort leaderboard; in-app notifications and course announcements (with email) | G2 |
| **v1.4 Operate** | Webhook retries with backoff + dead-letter view; S3-compatible storage adapter; Redis-backed rate limiting; `/api/health`; structured request logs; admin analytics dashboard (enrollments, completions, time-in-lesson); audit log | G4, G6 |

**Exit criteria:** a learner can find a course by keyword or tag, rate it, and follow a
learning path to completion with a streak intact; an essay can be graded by an instructor
and unlock course completion; the platform runs on Postgres + S3 + Redis from one container
with retried webhooks.

## Phase 5 — Intelligence (v2.0) · *the platform helps you teach*

**Goal:** collapse authoring time with an AI copilot and make the product global.

| Milestone | Scope | Goals |
| --- | --- | --- |
| **v2.0 Copilot** | Draft a course outline from a prompt; generate lessons and quiz questions from source text; per-lesson AI tutor for learners (grounded in the lesson); auto-summaries; model provider adapter with a deterministic mock for dev/CI | G1 |
| **v2.1 Global** | Per-org branding (logo, colours, custom domain); UI i18n (string catalogue + locale switch); accessibility audit to WCAG 2.2 AA; installable PWA with offline reading | G5 |
| **v2.2 Live** | Scheduled live sessions with calendar invites and recordings attached to lessons; office-hours booking | G2 |

## Cross-cutting tracks (every phase)

- **Quality:** unit tests for grading and progress logic; Playwright smoke tests for the
  author → publish → enroll → complete flow; CI on every PR.
- **Observability:** structured request logs, error reporting, basic product analytics
  (enrollments, completions, time-in-lesson).
- **Security:** dependency scanning, CSRF-safe mutations (server actions), sanitized
  Markdown, MIME-validated uploads, rate-limited auth endpoints.
- **Docs:** this folder is the source of truth; each milestone updates it.

## Sequencing rationale

1. Content before assessment: assessment is worthless without something to assess, and the
   player / progress model is the hardest part to retrofit.
2. Quizzes before gating: gating rules depend on the quiz result model.
3. Multi-tenancy last: it touches every query; doing it after the domain model is stable is
   cheaper than doing it speculatively.
