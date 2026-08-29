# Product Requirements — e-learner

Priorities use MoSCoW: **M** must, **S** should, **C** could. "Phase" refers to
[ROADMAP.md](./ROADMAP.md). IDs are stable and referenced from the roadmap and code.

## 1. Users, roles & auth

| ID | Requirement | Pri | Phase |
| --- | --- | --- | --- |
| AUTH-1 | Users can register with name, email and password; passwords are hashed (bcrypt). | M | 1 |
| AUTH-2 | Users can sign in and sign out; sessions are HTTP-only signed cookies. | M | 1 |
| AUTH-3 | Roles: `LEARNER`, `INSTRUCTOR`, `ADMIN`. New users default to `LEARNER`. | M | 1 |
| AUTH-4 | Admin can change a user's role. | M | 1 |
| AUTH-5 | The first registered user becomes `ADMIN` (bootstrap). | M | 1 |
| AUTH-6 | Password reset via email. | S | 3 |
| AUTH-7 | SSO (OIDC / SAML) for organizations. | C | 3 |

## 2. Course authoring

| ID | Requirement | Pri | Phase |
| --- | --- | --- | --- |
| AUTHOR-1 | Instructors can create a course with title, slug, summary, description (Markdown) and cover image. | M | 1 |
| AUTHOR-2 | A course contains ordered **modules**; a module contains ordered **lessons**. | M | 1 |
| AUTHOR-3 | Lesson types: `TEXT` (Markdown), `VIDEO` (upload or YouTube/Vimeo URL), `AUDIO` (upload), `IMAGE`, `FILE` (downloadable attachment). Every lesson also has an optional Markdown body. | M | 1 |
| AUTHOR-4 | Markdown supports GFM (tables, task lists), code blocks, images, links. Rendered HTML is sanitized. | M | 1 |
| AUTHOR-5 | Authors can upload media (images, audio, video, PDF) up to a configurable size limit; files are stored via a storage adapter (local disk in dev, S3-compatible in prod). | M | 1 |
| AUTHOR-6 | Authors can reorder modules and lessons. | M | 1 |
| AUTHOR-7 | Courses have status `DRAFT` / `PUBLISHED` / `ARCHIVED`. Only published courses are visible to learners. | M | 1 |
| AUTHOR-8 | Authors can preview a course as a learner before publishing. | S | 1 |
| AUTHOR-9 | Lessons have an estimated duration (minutes) that rolls up to module and course. | S | 1 |
| AUTHOR-10 | Lesson `QUIZ` type with questions and choices (see section 5). | M | 2 |
| AUTHOR-11 | Course-level setting: sequential (must complete lessons in order) vs free navigation. | S | 2 |
| AUTHOR-12 | Multiple instructors per course (co-authors). | C | 3 |
| AUTHOR-13 | Course versioning with learner-safe republish. | C | 3 |

## 3. Catalog, enrollment & learning

| ID | Requirement | Pri | Phase |
| --- | --- | --- | --- |
| LEARN-1 | Public catalog lists published courses with cover, title, summary, instructor, lesson count and duration. | M | 1 |
| LEARN-2 | A signed-in learner can enroll in a published course (self-enrollment). | M | 1 |
| LEARN-3 | Course player shows the module/lesson outline with completion state and the current lesson's content. | M | 1 |
| LEARN-4 | Learner can mark a lesson complete ("Mark complete & continue"). | M | 1 |
| LEARN-5 | Next / Previous navigation across module boundaries. | M | 1 |
| LEARN-6 | "My Learning" dashboard shows enrolled courses with % complete and a "Resume" link to the last lesson. | M | 1 |
| LEARN-7 | Course completion is recorded when all lessons are complete. | M | 1 |
| LEARN-8 | Video/audio players remember playback position. | C | 2 |
| LEARN-9 | Sequential courses lock lessons until prior ones are complete. | S | 2 |
| LEARN-10 | Certificate (PDF) issued on course completion. | S | 2 |
| LEARN-11 | Admin/instructor can enroll learners directly (or by CSV). | S | 2 |
| LEARN-12 | Cohorts with start/end dates and due dates. | C | 3 |
| LEARN-13 | Per-lesson discussion / Q&A. | C | 3 |
| LEARN-14 | Catalog search by keyword, filter by tag and level, sort by popularity / rating. | S | 4 |
| LEARN-15 | Learning paths: ordered bundles of courses with path-level progress. | S | 4 |
| LEARN-16 | Enrolled learners can rate (1–5) and review a course; averages shown in the catalog. | C | 4 |
| LEARN-17 | Daily streaks and points (lessons, quiz passes, completions) with a learner profile page. | S | 4 |
| LEARN-18 | Badges for milestones (first lesson, 7-day streak, quiz ace, course/path complete, reviewer). | C | 4 |
| LEARN-19 | In-app notifications (bell + page) and per-course announcements from instructors, optionally emailed. | S | 4 |
| LEARN-20 | Cohort leaderboard by points (course-wide for authors). | C | 4 |

## 4. Instructor & admin

| ID | Requirement | Pri | Phase |
| --- | --- | --- | --- |
| ADMIN-1 | Instructor dashboard: my courses, status, enrollment count, completion rate. | M | 1 |
| ADMIN-2 | Per-course learner list with progress %. | M | 1 |
| ADMIN-3 | Admin user list with role management. | M | 1 |
| ADMIN-4 | Per-quiz analytics: average score, hardest questions. | S | 2 |
| ADMIN-5 | Export progress / grades to CSV. | S | 2 |
| ADMIN-6 | Organizations (multi-tenant) with isolated catalogs. | C | 3 |

## 5. Assessment (Phase 2)

| ID | Requirement | Pri | Phase |
| --- | --- | --- | --- |
| QUIZ-1 | Question types: multiple choice (single), multiple select, true/false, short answer (case-insensitive exact match). | M | 2 |
| QUIZ-2 | Quiz settings: passing score %, max attempts (or unlimited), shuffle questions, show correct answers after submit. | M | 2 |
| QUIZ-3 | Auto-grading; attempt stored with per-question answers and score. | M | 2 |
| QUIZ-4 | A quiz lesson is complete only when an attempt meets the passing score. | M | 2 |
| QUIZ-5 | Learner sees attempt history and best score. | S | 2 |
| QUIZ-6 | Question feedback (explanation shown after answering). | S | 2 |
| QUIZ-7 | Essay questions with manual grading: instructor queue, points + feedback, attempt re-scored and lesson completed on pass. | S | 4 |
| QUIZ-8 | Timed quizzes: explicit start, server-side deadline, countdown with auto-submit, expired attempts score 0. | S | 4 |
| QUIZ-9 | Question banks: draw N random questions per attempt, fixed for that attempt. | C | 4 |

## 6. Copilot (Phase 5)

| ID | Requirement | MoSCoW | Phase |
| --- | --- | --- | --- |
| AI-1 | Draft a complete course (outline, lessons, quiz questions) from a short prompt, as a draft the author edits. | S | 5 |
| AI-2 | Draft a lesson body from its title and course context, inserted into the editor. | S | 5 |
| AI-3 | Generate quiz questions from the course's own lesson text. | S | 5 |
| AI-4 | Learner tutor grounded in the current lesson; refuses off-lesson questions and quiz answers. | C | 5 |
| AI-5 | Works offline with a deterministic mock; per-user rate limits; every generation audited. | M | 5 |

### Global (Phase 5)

| ID | Requirement | MoSCoW | Phase |
| --- | --- | --- | --- |

| GLB-1 | Organizations can set a name, logo, primary colour and tagline that members see across the app. | S | 5 |
| GLB-2 | UI strings available in English, Spanish and French; locale from a switcher or the browser. | S | 5 |
| GLB-3 | Learner and author pages pass an automated WCAG 2.2 AA audit; skip link and labelled landmarks. | M | 5 |
| GLB-4 | Installable PWA; lessons already opened stay readable offline. | C | 5 |

### Live (Phase 5)

| ID | Requirement | MoSCoW | Phase |
| --- | --- | --- | --- |
| LIVE-1 | Schedule live sessions per course or cohort with a join link; learners get a notification and a calendar invite. | S | 5 |
| LIVE-2 | RSVP (going / maybe / can't) with counts; downloadable .ics. | C | 5 |
| LIVE-3 | Attach a recording to a session and pin it to a lesson. | S | 5 |
| LIVE-4 | Office hours: instructors open slots, learners book one with a topic, hosts are notified. | C | 5 |

## 7. Non-functional

| ID | Requirement | Pri |
| --- | --- | --- |
| NFR-1 | Runs locally with one command (`npm run dev`) and no external services. | M |
| NFR-2 | Production deploy on any Node host or container; Postgres via `DATABASE_URL`. | M |
| NFR-3 | All authored HTML is sanitized (no stored XSS); uploads validated by MIME type and size. | M |
| NFR-4 | Authorization enforced server-side on every mutation (owner-or-admin for course edits). | M |
| NFR-5 | Responsive layout; course player usable on a phone. | S |
| NFR-6 | Accessibility: keyboard navigable, semantic headings, captions field on media. | S |
| NFR-7 | p95 page load < 500 ms for catalog and lesson pages at 10k courses / 100k enrollments. | S |
| NFR-9 | Webhook deliveries are persisted and retried with exponential backoff; dead-lettered deliveries are visible and retryable. | S | 4 |
| NFR-10 | Uploads can live on S3-compatible storage; media is proxied with Range support or redirected to a public URL. | S | 4 |
| NFR-11 | Rate limits shared across instances via Redis; `/api/health` reports dependency status; structured JSON logs; unhandled errors reported to a configurable endpoint. | S | 4 |
| NFR-12 | Privileged actions (roles, publishing, refunds, keys, webhooks) are written to an audit log. | C | 4 |

## Out of scope (for now)

Payments, live sessions/webinars, SCORM import, native mobile apps, AI content generation.
