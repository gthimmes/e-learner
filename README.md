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
| Account | Password reset by email (console mailer in dev, SMTP via `SMTP_URL` in prod); rate-limited sign-in and reset requests |
| Admin | User list and role management |

Roadmap status: **Phases 1–2 shipped; Phase 3 in progress** (v0.7 cohorts &amp; community done; organizations, interop and commerce next) — see [ROADMAP.md](docs/ROADMAP.md). CI runs lint, typecheck, unit, build and e2e on every push.

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
