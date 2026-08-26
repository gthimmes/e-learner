# Roadmap — e-learner

Requirement IDs reference [REQUIREMENTS.md](./REQUIREMENTS.md). Each phase ends in a
shippable release; nothing in a later phase is a prerequisite for using an earlier one.

**Status (2026-08-25):** Phase 1 ✅ shipped · Phase 2 ✅ shipped (v0.4–v0.6, all listed
requirements) · Phase 3 🔨 in progress — v0.7 ✅ (cohorts with due dates + reminders,
per-lesson discussion, password reset, rate-limited auth, CI on every push); v0.8–v1.0 next.
Tests: unit (grading), HTTP smoke, Playwright e2e (main flow + password reset).

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
