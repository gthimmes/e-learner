/**
 * Emails learners in cohorts whose due date is within the next N days (default 3)
 * and who have not completed the course. Run from cron, e.g. daily:
 *   npx tsx scripts/send-reminders.ts [--days 3] [--dry-run]
 */
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const db = new PrismaClient();
const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--days") + 1]) || 3;
const dryRun = args.includes("--dry-run");
const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

async function send(to: string, subject: string, text: string) {
  if (dryRun || !process.env.SMTP_URL) {
    console.log(`✉  ${dryRun ? "[dry-run] " : ""}${to} — ${subject}`);
    return;
  }
  await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM || "e-learner <no-reply@localhost>", to, subject, text });
}

async function main() {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86_400_000);
  const cohorts = await db.cohort.findMany({
    where: { dueAt: { gte: now, lte: horizon } },
    include: {
      course: { select: { title: true, slug: true } },
      enrollments: { where: { completedAt: null }, include: { user: { select: { name: true, email: true } }, _count: { select: { progress: true } } } },
    },
  });
  let sent = 0;
  for (const c of cohorts) {
    const dueStr = c.dueAt!.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    for (const e of c.enrollments) {
      await send(
        e.user.email,
        `Reminder: “${c.course.title}” is due ${dueStr}`,
        `Hi ${e.user.name},\n\nYour cohort “${c.name}” for “${c.course.title}” is due on ${dueStr} and you haven't finished yet.\n\nPick up where you left off: ${appUrl}/learn/${c.course.slug}\n\n— e-learner`,
      );
      sent++;
    }
  }
  console.log(`${sent} reminder(s) ${dryRun ? "would be " : ""}sent across ${cohorts.length} cohort(s) due within ${days} day(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
