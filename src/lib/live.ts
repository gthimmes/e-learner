import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth";
import { canEditCourse, type AccessCourse } from "./courses";
import { buildIcs } from "./ics";
import { appUrl } from "./mail";

export const sessionInclude = {
  cohort: { select: { id: true, name: true } },
  lesson: { select: { id: true, title: true } },
  _count: { select: { rsvps: true } },
};

/** Learners see sessions for everyone or for their own cohort; editors see all. */
export function sessionVisibleTo(user: SessionUser | null, course: AccessCourse, enrollment: { cohortId: string | null } | null, session: { cohortId: string | null }) {
  if (user && canEditCourse(user, course)) return true;
  if (!enrollment) return false;
  return !session.cohortId || session.cohortId === enrollment.cohortId;
}

export async function getSessions(courseId: string, userId: string | null) {
  const sessions = await db.liveSession.findMany({
    where: { courseId },
    orderBy: { startsAt: "asc" },
    include: { ...sessionInclude, rsvps: userId ? { where: { userId }, select: { status: true } } : false },
  });
  const now = Date.now();
  return sessions.map((s) => ({
    ...s,
    myRsvp: Array.isArray(s.rsvps) && s.rsvps[0] ? s.rsvps[0].status : null,
    isPast: s.endsAt.getTime() < now,
    isLive: s.startsAt.getTime() - 15 * 60_000 <= now && s.endsAt.getTime() >= now,
  }));
}

/** Upcoming sessions across everything the learner is enrolled in (My Learning strip). */
export async function getUpcomingForLearner(userId: string, limit = 5) {
  const enrollments = await db.enrollment.findMany({ where: { userId }, select: { courseId: true, cohortId: true } });
  if (enrollments.length === 0) return [];
  const byCourse = new Map(enrollments.map((e) => [e.courseId, e.cohortId]));
  const sessions = await db.liveSession.findMany({
    where: { courseId: { in: [...byCourse.keys()] }, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { course: { select: { slug: true, title: true } }, rsvps: { where: { userId }, select: { status: true } } },
    take: limit * 3,
  });
  return sessions.filter((s) => !s.cohortId || s.cohortId === byCourse.get(s.courseId)).slice(0, limit);
}

export async function getRecordingsForLesson(lessonId: string) {
  return db.liveSession.findMany({ where: { lessonId, recordingUrl: { not: "" } }, orderBy: { startsAt: "desc" }, select: { id: true, title: true, startsAt: true, recordingUrl: true } });
}

export function sessionIcs(s: { id: string; title: string; description: string; startsAt: Date; endsAt: Date; joinUrl: string }, course: { slug: string; title: string }, organizer?: { name: string; email: string }) {
  return buildIcs(
    [
      {
        uid: `live-${s.id}@e-learner`,
        start: s.startsAt,
        end: s.endsAt,
        summary: `${course.title}: ${s.title}`,
        description: [s.description, s.joinUrl ? `Join: ${s.joinUrl}` : "", `Course: ${appUrl(`/courses/${course.slug}`)}`].filter(Boolean).join("\n"),
        url: s.joinUrl || appUrl(`/courses/${course.slug}`),
        location: s.joinUrl || undefined,
        organizer,
      },
    ],
    { method: "REQUEST" },
  );
}

// ---------- Office hours ----------

export async function getOfficeHours(courseId: string) {
  const slots = await db.officeHourSlot.findMany({ where: { courseId, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } });
  const ids = [...new Set(slots.map((s) => s.bookedById).filter((x): x is string => !!x))];
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return slots.map((s) => ({ ...s, bookedBy: s.bookedById ? (byId.get(s.bookedById) ?? null) : null }));
}
