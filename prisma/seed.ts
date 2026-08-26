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
                  mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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

  console.log("Seeded:");
  console.log(`  admin      ${admin.email} / password123`);
  console.log(`  instructor ${instructor.email} / password123`);
  console.log(`  learner    ${learner.email} / password123`);
  console.log(`  course     /courses/${course.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
