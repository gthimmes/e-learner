"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser } from "@/lib/auth";
import { assertCourseAccess, canEditCourse, accessSelect } from "@/lib/courses";
import { notifyMany, notify } from "@/lib/engage";
import { mailer, appUrl } from "@/lib/mail";
import { sessionIcs } from "@/lib/live";
import { audit } from "@/lib/audit";
import { formBool, formStr } from "@/lib/validation";
import { formatDate } from "@/lib/utils";

function parseLocal(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("Enter a valid date and time.");
  return d;
}

async function revalidate(courseId: string, slug: string) {
  revalidatePath(`/author/${courseId}/live`);
  revalidatePath(`/courses/${slug}`);
  revalidatePath(`/learn/${slug}`, "layout");
  revalidatePath("/learn");
}

// ---------- Sessions ----------

export async function createSession(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const course = await assertCourseAccess(courseId, user);
  const title = formStr(formData, "title").trim().slice(0, 140);
  if (!title) throw new Error("Title is required.");
  const startsAt = parseLocal(formStr(formData, "startsAt"));
  const durationMin = Math.max(5, Math.min(600, Number(formStr(formData, "durationMin")) || 60));
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const cohortId = formStr(formData, "cohortId") || null;
  if (cohortId && !(await db.cohort.findFirst({ where: { id: cohortId, courseId } }))) throw new Error("Cohort not found.");
  const session = await db.liveSession.create({
    data: { courseId, cohortId, title, description: formStr(formData, "description").trim().slice(0, 4000), startsAt, endsAt, joinUrl: formStr(formData, "joinUrl").trim().slice(0, 500), createdById: user.id },
  });
  await audit(user, "live.create", { type: "liveSession", id: session.id }, { title, startsAt: startsAt.toISOString() });

  if (formBool(formData, "invite")) {
    const full = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { slug: true, title: true } });
    const learners = await db.enrollment.findMany({ where: { courseId, ...(cohortId ? { cohortId } : {}) }, select: { user: { select: { id: true, email: true, name: true } } } });
    const when = `${formatDate(startsAt)} ${startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
    await notifyMany(
      learners.map((l) => l.user.id),
      { type: "live", title: `📅 Live session: ${title}`, body: `${full.title} · ${when}`, href: `/courses/${full.slug}#live` },
    );
    const ics = sessionIcs(session, full, { name: user.name, email: user.email });
    await Promise.all(
      learners.map((l) =>
        mailer
          .send({
            to: l.user.email,
            subject: `[${full.title}] Live session: ${title} — ${when}`,
            text: `Hi ${l.user.name},\n\n${title}\n${when}\n${session.joinUrl ? `Join: ${session.joinUrl}\n` : ""}\nRSVP and details: ${appUrl(`/courses/${full.slug}#live`)}\n\n— e-learner`,
            attachments: [{ filename: "invite.ics", content: ics, contentType: "text/calendar; method=REQUEST" }],
          })
          .catch((e) => console.error("invite mail failed", e)),
      ),
    );
  }
  await revalidate(courseId, course.slug);
}

export async function deleteSession(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "sessionId");
  const s = await db.liveSession.findUnique({ where: { id }, include: { course: { select: { id: true, slug: true } } } });
  if (!s) return;
  await assertCourseAccess(s.courseId, user);
  await db.liveSession.delete({ where: { id } });
  await revalidate(s.courseId, s.course.slug);
}

/** Attaches a recording URL (YouTube/Vimeo/MP4) and optionally pins it to a lesson. */
export async function attachRecording(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "sessionId");
  const s = await db.liveSession.findUnique({ where: { id }, include: { course: { select: { id: true, slug: true } } } });
  if (!s) throw new Error("Session not found.");
  await assertCourseAccess(s.courseId, user);
  const lessonId = formStr(formData, "lessonId") || null;
  if (lessonId && !(await db.lesson.findFirst({ where: { id: lessonId, module: { courseId: s.courseId } } }))) throw new Error("Lesson not found.");
  await db.liveSession.update({ where: { id }, data: { recordingUrl: formStr(formData, "recordingUrl").trim().slice(0, 500), lessonId } });
  await revalidate(s.courseId, s.course.slug);
}

export async function rsvp(formData: FormData) {
  const user = await actionUser();
  const sessionId = formStr(formData, "sessionId");
  const status = formStr(formData, "status");
  if (!["GOING", "MAYBE", "NO"].includes(status)) throw new Error("Invalid RSVP.");
  const s = await db.liveSession.findUnique({ where: { id: sessionId }, include: { course: { select: { ...accessSelect, slug: true } } } });
  if (!s) throw new Error("Session not found.");
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: s.courseId } }, select: { cohortId: true } });
  if (!enrollment && !canEditCourse(user, s.course)) throw new Error("Enroll in the course first.");
  if (enrollment && s.cohortId && s.cohortId !== enrollment.cohortId) throw new Error("This session is for another cohort.");
  await db.sessionRsvp.upsert({ where: { sessionId_userId: { sessionId, userId: user.id } }, update: { status }, create: { sessionId, userId: user.id, status } });
  await revalidate(s.courseId, s.course.slug);
}

// ---------- Office hours ----------

/** Creates `count` back-to-back slots starting at `startsAt`. */
export async function createOfficeHours(formData: FormData) {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  const course = await assertCourseAccess(courseId, user);
  const start = parseLocal(formStr(formData, "startsAt"));
  const minutes = Math.max(5, Math.min(120, Number(formStr(formData, "slotMinutes")) || 20));
  const count = Math.max(1, Math.min(24, Number(formStr(formData, "count")) || 3));
  await db.officeHourSlot.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      courseId,
      hostId: user.id,
      startsAt: new Date(start.getTime() + i * minutes * 60_000),
      endsAt: new Date(start.getTime() + (i + 1) * minutes * 60_000),
    })),
  });
  await revalidate(courseId, course.slug);
}

export async function deleteSlot(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "slotId");
  const slot = await db.officeHourSlot.findUnique({ where: { id }, include: { course: { select: { id: true, slug: true } } } });
  if (!slot) return;
  await assertCourseAccess(slot.courseId, user);
  await db.officeHourSlot.delete({ where: { id } });
  await revalidate(slot.courseId, slot.course.slug);
}

export async function bookSlot(formData: FormData) {
  const user = await actionUser();
  const id = formStr(formData, "slotId");
  const note = formStr(formData, "note").trim().slice(0, 300);
  const slot = await db.officeHourSlot.findUnique({ where: { id }, include: { course: { select: { id: true, slug: true, title: true } } } });
  if (!slot) throw new Error("Slot not found.");
  const enrolled = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: slot.courseId } }, select: { id: true } });
  if (!enrolled) throw new Error("Enroll in the course first.");
  // Only the first booking wins: update where still free.
  const r = await db.officeHourSlot.updateMany({ where: { id, bookedById: null }, data: { bookedById: user.id, note } });
  if (r.count === 0) throw new Error("That slot was just taken — pick another.");
  await notify(slot.hostId, { type: "live", title: `🗓 Office hours booked: ${user.name}`, body: `${slot.course.title} · ${formatDate(slot.startsAt)} ${slot.startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}${note ? ` · "${note}"` : ""}`, href: `/author/${slot.courseId}/live` });
  await revalidate(slot.courseId, slot.course.slug);
}

export async function cancelBooking(formData: FormData) {
  const user = await actionUser();
  const id = formStr(formData, "slotId");
  const slot = await db.officeHourSlot.findUnique({ where: { id }, include: { course: { select: { id: true, slug: true } } } });
  if (!slot || slot.bookedById !== user.id) return;
  await db.officeHourSlot.update({ where: { id }, data: { bookedById: null, note: "" } });
  await revalidate(slot.courseId, slot.course.slug);
}
