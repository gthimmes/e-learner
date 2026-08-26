# e-learner

A lightweight platform for **creating online courses** (reading, images, audio, video — and
quizzes next) and **taking them** with enrollment and progress tracking.

- 📄 [Vision](docs/VISION.md) · 📋 [Requirements](docs/REQUIREMENTS.md) · 🗺️ [Roadmap](docs/ROADMAP.md) · 🏗️ [Architecture](docs/ARCHITECTURE.md)

## Quick start

```bash
npm install            # also runs `prisma generate`
npm run db:migrate     # creates prisma/dev.db (SQLite) and applies migrations
npm run db:seed        # demo users + a sample course
npm run dev            # http://localhost:3000
```

Demo accounts (password `password123`):

| Role | Email |
| --- | --- |
| Admin | admin@example.com |
| Instructor | instructor@example.com |
| Learner | learner@example.com |

Or register fresh — the **first account created becomes the admin**.

## What's built

| Area | Features |
| --- | --- |
| Authoring | Courses → modules → lessons; lesson types Reading / Video / Audio / Image / Download / **Quiz**; Markdown (GFM) with sanitized rendering; media upload or YouTube/Vimeo links; reorder; draft → publish → archive; preview as learner; sequential (locked) courses |
| Quizzes | Question types: multiple choice, multiple select, true/false, short answer; points, explanations; pass mark, attempt limits, shuffle, answer reveal; auto-grading; attempt history; passing completes the lesson |
| Learning | Public catalog; self-enrollment; course player with outline and completion state; mark complete & continue; next/previous; media playback position memory; My Learning with resume; course completion; printable certificate |
| Instructor | Dashboard with enrollment and completion counts; per-course learner progress; enroll by email; CSV export; per-quiz analytics (pass rate, average, hardest questions) |
| Cohorts &amp; community | Cohorts with start / due / end dates; overdue flags for learners and instructors; due-date reminder script (`npx tsx scripts/send-reminders.ts`); per-lesson discussion with replies and moderation |
| Account | Password reset by email (console mailer in dev, SMTP via `SMTP_URL` in prod); rate-limited sign-in and reset requests; **SSO via any OpenID Connect provider** (`OIDC_*` env; mock IdP in `scripts/mock-oidc.mjs`) |
| Organizations | Private per-organization catalogs: org members author org-only courses, outsiders get 404; org admin console (`/org`) for members and courses; platform admins manage orgs at `/admin/orgs`; **co-authors** per course |
| Admin | User list with role, organization and org-admin management |
| Interop | **Course versions**: snapshot on every publish, manual snapshots, restore (keeps learner progress on surviving lessons); **REST API** with per-user API keys and OpenAPI description (`/api/v1/openapi.json`); **webhooks** (HMAC-signed, delivery log, test ping); **xAPI** statement export + optional live forwarding to an LRS; **SCORM 1.2** package download per course |

| Commerce | Paid courses (price + currency per course) with **Stripe Checkout** (or an in-app mock provider when Stripe isn't configured); coupons (% off, max uses, expiry, 100 % = free enrollment); refunds that revoke access; per-course sales &amp; revenue page; Stripe webhook for async confirmation and external refunds |

Roadmap status: **all three phases shipped** (v0.1–v1.0) — see [ROADMAP.md](docs/ROADMAP.md) for what's next. CI runs lint, typecheck, unit, build and e2e on every push.

### Payments setup

Set a price under the course's Details. Without Stripe keys, checkout uses an in-app mock page (clearly labelled) so the whole flow works locally and in CI. For real payments set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and point a Stripe webhook at `${APP_URL}/api/stripe/webhook` for `checkout.session.completed` and `charge.refunded`. Returning from Checkout also verifies the session directly, so enrollment works even before the webhook lands.

### REST API, webhooks, xAPI, SCORM

- Create API keys under **Integrations** (instructors/admins). Call `GET /api/v1/me`, `GET /api/v1/courses[?mine=1]`, `GET /api/v1/courses/{id}`, `GET|POST /api/v1/courses/{id}/enrollments`, `GET /api/v1/courses/{id}/xapi` with `Authorization: Bearer elk_…`.
- Webhooks POST JSON for `enrollment.created`, `lesson.completed`, `course.completed`, `quiz.attempted`; verify `X-Elearner-Signature` (`sha256=` HMAC of the raw body with the webhook secret).
- Set `XAPI_LRS_URL` (+ `XAPI_LRS_AUTH`) to forward statements to a Learning Record Store as they happen.
- **SCORM**: course editor → *SCORM* downloads a SCORM 1.2 zip (one SCO per lesson, bundled uploads, completion reporting).

### SSO setup

Set `OIDC_ISSUER`, `OIDC_CLIENT_ID` and (if your IdP requires it) `OIDC_CLIENT_SECRET`; register `${APP_URL}/api/auth/oidc/callback` as the redirect URI. Optional: `OIDC_ORG_SLUG` auto-joins SSO users to an organization, `OIDC_BUTTON_LABEL` changes the button text. Users are matched by email; new users are created as learners. For local testing run `node scripts/mock-oidc.mjs` with `OIDC_ISSUER=http://localhost:3400 OIDC_CLIENT_ID=e-learner`.

## Testing

```bash
npm test               # unit tests (grading engine)
npm run test:smoke     # HTTP smoke test against a running dev server on :3100 (seeded DB)
npm run test:e2e       # Playwright end-to-end: author → publish → enroll → quiz → certificate
```

`npx playwright install chromium` once before the e2e suite.

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 ·
SQLite (dev) / PostgreSQL (prod) · `jose` sessions · `react-markdown` + `rehype-sanitize`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Create & apply a migration (`prisma migrate dev`) |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run typecheck` / `npm run lint` | Static checks |

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | For Postgres, set the URL and change `provider` in `prisma/schema.prisma` |
| `SESSION_SECRET` | dev value | **Change in production** — the app refuses to start with the dev value |
| `UPLOAD_DIR` | `./uploads` | Local media storage (git-ignored) |
| `MAX_UPLOAD_MB` | `200` | Upload size limit |
| `APP_URL` | `http://localhost:3000` | Base URL used in emails (reset links, reminders) |
| `SMTP_URL` | unset | `smtp://user:pass@host:587` — when unset, mail is printed to the server console |
| `MAIL_FROM` | `e-learner <no-reply@localhost>` | Sender address |

## Project layout

```
docs/            product docs (vision, requirements, roadmap, architecture)
prisma/          schema, migrations, seed
src/app/         routes: catalog, courses, learn, author, admin, api
src/components/  UI, forms, markdown, media player
src/lib/         auth, db, storage, queries, server actions, validation
```
