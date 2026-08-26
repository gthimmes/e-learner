# Vision — e-learner

## One-liner

**e-learner** is a lightweight learning platform that lets anyone assemble a course from
reading, images, audio and video, publish it, and let learners work through it at their own
pace — with progress tracking, and (soon) assessment that proves they learned it.

## The problem

Most teams and individual educators who need to teach something online today are squeezed
between two bad options:

1. **Heavyweight LMSs** (Moodle, Canvas, Blackboard) — built for universities, expensive to
   run, and require a week of configuration before the first lesson can be written.
2. **Content-only tools** (Notion pages, Google Docs, a YouTube playlist) — fast to produce,
   but with no structure, no enrollment, no progress, and no way to confirm anyone actually
   learned the material.

There is a gap for a tool where **authoring a course is as easy as writing a document**, and
**taking a course feels like a focused, sequenced experience** rather than a pile of links.

## Who it's for

| Persona | Goal | What "great" looks like |
| --- | --- | --- |
| **Instructor / Author** (subject-matter expert, trainer, team lead) | Turn knowledge into a structured course quickly | Draft → publish in an afternoon; edit without breaking enrolled learners |
| **Learner** (employee, student, customer) | Learn the material and prove it | Always know where they are, what's next, and what's complete |
| **Admin** (ops owner, L&D manager) | Run the platform, manage people, see outcomes | Who's enrolled, who's finished, who's stuck |

## Product principles

1. **Writing beats configuring.** A lesson is a Markdown document with media dropped in.
   No block editors to fight, no theme settings to tune before you can start.
2. **Structure is the product.** Course → Module → Lesson is a first-class hierarchy with
   ordering, prerequisites and progress. That is what separates a course from a folder.
3. **Publish is a deliberate act.** Drafts are private; published courses are stable for
   learners. Authors can keep editing safely.
4. **Progress is honest.** Completion is recorded per lesson, per learner, and (later)
   gated by assessment. Reports reflect what actually happened.
5. **Small core, open edges.** Storage, media, auth and email sit behind interfaces so the
   platform can start on a laptop and grow to a hosted, multi-tenant service.

## Where we're going (18-month arc)

- **Now (Phase 1 — Learn):** author and deliver content courses: text, images, audio, video;
  modules and lessons; enrollment; per-lesson progress; instructor dashboard.
- **Next (Phase 2 — Assess):** quizzes with auto-graded question types, passing scores,
  attempts, lesson gating, certificates on completion.
- **Later (Phase 3 — Scale):** cohorts and due dates, discussion, rich analytics, SCORM /
  xAPI export, organizations & SSO, payments / paid courses, mobile-friendly offline reading.

## Success metrics

| Metric | Phase 1 target |
| --- | --- |
| Time from sign-up to first published course | < 30 minutes |
| Lesson completion rate (enrolled learners who finish ≥ 1 lesson) | > 70 % |
| Course completion rate | > 40 % |
| Author edits that require learner-facing downtime | 0 |
