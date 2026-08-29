/* Demo data: an admin, an instructor, a learner, and a published sample course.
   Run with `npm run db:seed`. Idempotent — re-running updates in place. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function upsertUser(email: string, name: string, role: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return db.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role, passwordHash },
  });
}

async function main() {
  const admin = await upsertUser("admin@example.com", "Ada Admin", "ADMIN", "password123");
  const instructor = await upsertUser("instructor@example.com", "Ian Instructor", "INSTRUCTOR", "password123");
  const learner = await upsertUser("learner@example.com", "Lee Learner", "LEARNER", "password123");

  // Reset the demo course so the seed is idempotent.
  await db.course.deleteMany({ where: { slug: "intro-to-online-teaching" } });

  const course = await db.course.create({
    data: {
      slug: "intro-to-online-teaching",
      title: "Introduction to Online Teaching",
      summary: "Learn how to design, structure and deliver an engaging online course in an afternoon.",
      description: `## What you'll learn

- How to break a topic into **modules and lessons** learners can actually finish
- When to use reading, video, audio or images
- How to check understanding without a heavyweight exam

## Who it's for

Anyone with something to teach: trainers, team leads, subject-matter experts.

> "Writing beats configuring." — the e-learner principle`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      instructorId: instructor.id,
      tags: "teaching,course-design,beginner",
      level: "BEGINNER",
      featured: true,
      coverUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=70",
      modules: {
        create: [
          {
            title: "Getting started",
            summary: "Why structure matters and how this course works.",
            position: 0,
            lessons: {
              create: [
                {
                  title: "Welcome",
                  type: "TEXT",
                  position: 0,
                  durationMin: 3,
                  body: `# Welcome!

This short course shows what an **e-learner** course looks like from the inside.

Each lesson is a Markdown document. You can use:

1. Ordered and unordered lists
2. **Bold**, *italic* and \`code\`
3. Tables, task lists and images

| Element | Purpose |
| --- | --- |
| Module | Groups related lessons |
| Lesson | One idea, one sitting |

- [x] Enroll in the course
- [ ] Finish every lesson

When you're done reading, press **Mark complete & continue**.`,
                },
                {
                  title: "Why structure matters (video)",
                  type: "VIDEO",
                  position: 1,
                  durationMin: 8,
                  mediaUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", // Big Buck Bunny (Blender Foundation, CC-BY)
                  mediaCaption: "Replace this with your own video — YouTube, Vimeo, or an uploaded MP4.",
                  body: `Video lessons can embed **YouTube** or **Vimeo** links, or play an MP4/WebM you upload directly.

Add notes, timestamps or a transcript below the video using Markdown.`,
                },
              ],
            },
          },
          {
            title: "Choosing your media",
            summary: "Match the medium to the message.",
            position: 1,
            lessons: {
              create: [
                {
                  title: "Reading vs. watching vs. listening",
                  type: "TEXT",
                  position: 0,
                  durationMin: 6,
                  body: `## Pick the medium that fits

| Medium | Best for | Watch out for |
| --- | --- | --- |
| Reading | Reference material, precise steps | Walls of text |
| Video | Demonstrations, tone, motivation | Long unedited recordings |
| Audio | Interviews, commuting learners | Anything visual |
| Images | Diagrams, before/after | Missing alt text |

A good rule: **one idea per lesson, under ten minutes.**`,
                },
                {
                  title: "Diagram: the course hierarchy",
                  type: "IMAGE",
                  position: 1,
                  durationMin: 2,
                  mediaUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1400&q=70",
                  mediaCaption: "Course → Module → Lesson. Every lesson records progress per learner.",
                  body: "Image lessons are great for diagrams, cheat sheets and annotated screenshots.",
                },
                {
                  title: "Audio: a two-minute pep talk",
                  type: "AUDIO",
                  position: 2,
                  durationMin: 2,
                  mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Toreador_song_cleaned.ogg",
                  mediaCaption: "Sample public-domain audio. Upload your own MP3 from the lesson editor.",
                  body: "Audio lessons play inline and remember where you left off in a later release.",
                },
              ],
            },
          },
          {
            title: "Wrapping up",
            summary: "Next steps and resources.",
            position: 2,
            lessons: {
              create: [
                {
                  title: "Checklist & next steps",
                  type: "TEXT",
                  position: 0,
                  durationMin: 4,
                  body: `## Before you publish

- [ ] Every lesson has a clear title and a duration
- [ ] Media has a caption
- [ ] The course summary says who it is for
- [ ] You previewed the course as a learner

## What's next

Assessment is on the roadmap: quizzes that gate completion and issue certificates.

Thanks for taking the tour — now go build something!`,
                },
                {
                  title: "Knowledge check",
                  type: "QUIZ",
                  position: 1,
                  durationMin: 5,
                  passingScore: 70,
                  maxAttempts: 0,
                  showAnswers: true,
                  body: "Answer all questions. You need **70%** to pass and complete the course.",
                  questions: {
                    create: [
                      {
                        type: "SINGLE",
                        position: 0,
                        points: 1,
                        prompt: "What is the recommended maximum length of a single lesson?",
                        explanation: "One idea per lesson, under ten minutes.",
                        choices: {
                          create: [
                            { text: "Under 10 minutes", isCorrect: true, position: 0 },
                            { text: "About 30 minutes", isCorrect: false, position: 1 },
                            { text: "As long as it takes", isCorrect: false, position: 2 },
                          ],
                        },
                      },
                      {
                        type: "MULTI",
                        position: 1,
                        points: 2,
                        prompt: "Which media types does e-learner support in a lesson? (select all that apply)",
                        choices: {
                          create: [
                            { text: "Video", isCorrect: true, position: 0 },
                            { text: "Audio", isCorrect: true, position: 1 },
                            { text: "Live webinars", isCorrect: false, position: 2 },
                            { text: "Images", isCorrect: true, position: 3 },
                          ],
                        },
                      },
                      {
                        type: "TRUE_FALSE",
                        position: 2,
                        points: 1,
                        prompt: "Draft courses are visible in the public catalog.",
                        explanation: "Only published courses appear in the catalog.",
                        choices: {
                          create: [
                            { text: "True", isCorrect: false, position: 0 },
                            { text: "False", isCorrect: true, position: 1 },
                          ],
                        },
                      },
                      {
                        type: "SHORT",
                        position: 3,
                        points: 1,
                        prompt: "What markup language are lessons written in?",
                        answerText: "Markdown\nmd\nGFM",
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  // Enroll the demo learner and complete the first lesson.
  const firstLesson = course.modules[0]!.lessons[0]!;
  const enrollment = await db.enrollment.upsert({
    where: { userId_courseId: { userId: learner.id, courseId: course.id } },
    update: {},
    create: { userId: learner.id, courseId: course.id, lastLessonId: firstLesson.id },
  });
  await db.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: firstLesson.id } },
    update: {},
    create: { enrollmentId: enrollment.id, lessonId: firstLesson.id },
  });

  // Organization demo: a private org with an org admin, an instructor and a private course.
  const org = await db.organization.upsert({ where: { slug: "acme" }, update: { name: "Acme Corp" }, create: { slug: "acme", name: "Acme Corp" } });
  const orgAdmin = await upsertUser("orgadmin@acme.example.com", "Olivia OrgAdmin", "INSTRUCTOR", "password123");
  const orgLearner = await upsertUser("staff@acme.example.com", "Sam Staff", "LEARNER", "password123");
  await db.user.updateMany({ where: { id: { in: [orgAdmin.id, orgLearner.id] } }, data: { organizationId: org.id } });
  await db.user.update({ where: { id: orgAdmin.id }, data: { orgAdmin: true } });
  await db.course.deleteMany({ where: { slug: "acme-onboarding" } });
  await db.course.create({
    data: {
      slug: "acme-onboarding",
      title: "Acme Onboarding",
      summary: "Private to Acme Corp staff: tools, policies and who to ask.",
      description: "Welcome to Acme! This course is only visible to members of the Acme organization.",
      status: "PUBLISHED",
      publishedAt: new Date(),
      instructorId: orgAdmin.id,
      organizationId: org.id,
      tags: "onboarding,acme",
      modules: {
        create: [
          {
            title: "Day one",
            position: 0,
            lessons: {
              create: [
                { title: "Your first week", type: "TEXT", position: 0, durationMin: 5, body: "## Welcome\n\n- Get your laptop\n- Meet your buddy\n- Read the handbook" },
                { title: "Security basics", type: "TEXT", position: 1, durationMin: 5, body: "Use a password manager and enable 2FA everywhere." },
              ],
            },
          },
        ],
      },
    },
  });

  // ---------- Phase 4: a second public course, reviews and a learning path ----------
  await db.course.deleteMany({ where: { slug: "assessment-design-basics" } });
  const assessment = await db.course.create({
    data: {
      slug: "assessment-design-basics",
      title: "Assessment Design Basics",
      summary: "Write quiz questions that actually measure understanding, and set fair pass marks.",
      description: `## What you'll learn

- Choosing between multiple choice, multi-select, true/false and short answer
- Writing distractors that are plausible but wrong
- Setting a pass mark and attempt limits without punishing learners

## Prerequisites

Take **Introduction to Online Teaching** first if you're new to course design.`,
      status: "PUBLISHED",
      publishedAt: new Date(Date.now() - 86_400_000),
      instructorId: instructor.id,
      tags: "teaching,assessment,quizzes",
      level: "INTERMEDIATE",
      coverUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=70",
      modules: {
        create: [
          {
            title: "Writing good questions",
            position: 0,
            lessons: {
              create: [
                {
                  title: "What a question is for",
                  type: "TEXT",
                  position: 0,
                  durationMin: 5,
                  body: `## One question, one idea

A good quiz question checks **one** thing. If a learner gets it wrong you should know *what* they misunderstood.

| Type | Use when |
| --- | --- |
| Multiple choice | There is one best answer and good distractors |
| Multiple select | Several things are true at once |
| True / false | A common misconception needs confronting |
| Short answer | Recall matters (a term, a number, a command) |`,
                },
                {
                  title: "Distractors and pass marks",
                  type: "TEXT",
                  position: 1,
                  durationMin: 6,
                  body: `## Distractors

Wrong answers should be **plausible**: things a learner who half-understood would pick.

## Pass marks

- 70 % is a sensible default for knowledge checks
- Use unlimited attempts when the goal is learning, not certification
- Show explanations after each attempt so a failed attempt still teaches`,
                },
                {
                  title: "Check your understanding",
                  type: "QUIZ",
                  position: 2,
                  durationMin: 4,
                  passingScore: 60,
                  body: "Two quick questions. **60%** to pass.",
                  questions: {
                    create: [
                      {
                        type: "SINGLE",
                        position: 0,
                        points: 1,
                        prompt: "How many ideas should one quiz question test?",
                        explanation: "One idea per question makes wrong answers diagnostic.",
                        choices: { create: [{ text: "One", isCorrect: true, position: 0 }, { text: "As many as possible", isCorrect: false, position: 1 }] },
                      },
                      {
                        type: "TRUE_FALSE",
                        position: 1,
                        points: 1,
                        prompt: "Distractors should be obviously wrong so learners aren't tricked.",
                        explanation: "Distractors should be plausible, not obvious.",
                        choices: { create: [{ text: "True", isCorrect: false, position: 0 }, { text: "False", isCorrect: true, position: 1 }] },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  // Reviews (learner is enrolled in the intro course; enroll org staff too so they can review it).
  await db.enrollment.upsert({
    where: { userId_courseId: { userId: orgLearner.id, courseId: course.id } },
    update: {},
    create: { userId: orgLearner.id, courseId: course.id },
  });
  await db.review.upsert({
    where: { userId_courseId: { userId: learner.id, courseId: course.id } },
    update: { rating: 5, body: "Clear, practical and short. I built my first course the same afternoon." },
    create: { userId: learner.id, courseId: course.id, rating: 5, body: "Clear, practical and short. I built my first course the same afternoon." },
  });
  await db.review.upsert({
    where: { userId_courseId: { userId: orgLearner.id, courseId: course.id } },
    update: { rating: 4, body: "Good overview. Would love more on video production." },
    create: { userId: orgLearner.id, courseId: course.id, rating: 4, body: "Good overview. Would love more on video production." },
  });

  // Learning path bundling both public courses.
  await db.learningPath.deleteMany({ where: { slug: "online-instructor" } });
  await db.learningPath.create({
    data: {
      slug: "online-instructor",
      title: "Become an Online Instructor",
      summary: "From your first course outline to assessments that prove learning happened.",
      description: "Two short courses, in order. Finish both to complete the path.",
      status: "PUBLISHED",
      createdById: instructor.id,
      items: { create: [{ courseId: course.id, position: 0 }, { courseId: assessment.id, position: 1 }] },
    },
  });

  console.log("Seeded:");
  console.log(`  org admin  ${orgAdmin.email} / password123  (Acme Corp)`);
  console.log(`  org staff  ${orgLearner.email} / password123  (Acme Corp)`);
  console.log(`  admin      ${admin.email} / password123`);
  console.log(`  instructor ${instructor.email} / password123`);
  console.log(`  learner    ${learner.email} / password123`);
  console.log(`  course     /courses/${course.slug}`);
  console.log(`  course     /courses/${assessment.slug}`);
  console.log(`  path       /paths/online-instructor`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
