import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { flattenLessons, getCourseForAuthor } from "@/lib/courses";
import { db } from "@/lib/db";
import { getOfficeHours, getSessions } from "@/lib/live";
import { attachRecording, createOfficeHours, createSession, deleteSession, deleteSlot } from "@/lib/actions/live";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Field, Input, Label, LinkButton, PageHeader, Select, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Live sessions" };

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default async function LivePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/live`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const [sessions, cohorts, slots] = await Promise.all([getSessions(courseId, user.id), db.cohort.findMany({ where: { courseId }, orderBy: { startsAt: "desc" } }), getOfficeHours(courseId)]);
  const lessons = flattenLessons(course);
  const upcoming = sessions.filter((s) => !s.isPast);
  const past = sessions.filter((s) => s.isPast);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-2 text-sm text-zinc-500">
        <Link href={`/author/${course.id}`} className="hover:underline">
          {course.title}
        </Link>{" "}
        / Live
      </div>
      <PageHeader
        title="Live sessions & office hours"
        subtitle="Schedule sessions (learners get an in-app notice and a calendar invite), attach recordings to lessons afterwards, and open bookable office-hour slots."
        actions={
          <LinkButton href={`/author/${course.id}`} variant="secondary">
            ← Back to editor
          </LinkButton>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
            {upcoming.length === 0 ? <p className="text-sm text-zinc-500">Nothing scheduled.</p> : null}
            <ul className="space-y-3">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {s.title} {s.isLive ? <Badge tone="success">Live now</Badge> : null}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatDate(s.startsAt)} {time(s.startsAt)}–{time(s.endsAt)} · {s.cohort ? s.cohort.name : "everyone"} · {s._count.rsvps} RSVP{s._count.rsvps === 1 ? "" : "s"}
                          {s.joinUrl ? (
                            <>
                              {" · "}
                              <a href={s.joinUrl} className="text-indigo-600 underline" target="_blank" rel="noreferrer">
                                join link
                              </a>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <form action={deleteSession}>
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button className="text-xs text-zinc-500 hover:text-red-600">Cancel session</button>
                      </form>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Past · recordings</h2>
            {past.length === 0 ? <p className="text-sm text-zinc-500">No past sessions yet.</p> : null}
            <ul className="space-y-3">
              {past.map((s) => (
                <li key={s.id}>
                  <Card>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-zinc-500">
                      {formatDate(s.startsAt)} · {s._count.rsvps} RSVP{s._count.rsvps === 1 ? "" : "s"}
                      {s.recordingUrl ? <> · recording attached{s.lesson ? ` to “${s.lesson.title}”` : ""}</> : null}
                    </div>
                    <form action={attachRecording} className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                      <input type="hidden" name="sessionId" value={s.id} />
                      <Input name="recordingUrl" defaultValue={s.recordingUrl} placeholder="Recording URL (YouTube, Vimeo or MP4)" aria-label="Recording URL" />
                      <Select name="lessonId" defaultValue={s.lessonId ?? ""} aria-label="Show on lesson">
                        <option value="">Not on a lesson</option>
                        {lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.moduleTitle} › {l.title}
                          </option>
                        ))}
                      </Select>
                      <SubmitButton size="sm" variant="secondary" pendingText="Saving…">
                        Attach recording
                      </SubmitButton>
                    </form>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Office hours</h2>
            {slots.length === 0 ? <p className="text-sm text-zinc-500">No upcoming slots.</p> : null}
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {slots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span>
                    {formatDate(s.startsAt)} {time(s.startsAt)}–{time(s.endsAt)}
                  </span>
                  <span className="flex items-center gap-3">
                    {s.bookedBy ? (
                      <span>
                        <Badge tone="info">Booked</Badge> {s.bookedBy.name} <span className="text-zinc-500">({s.bookedBy.email})</span>
                        {s.note ? <span className="text-zinc-500"> · “{s.note}”</span> : null}
                      </span>
                    ) : (
                      <Badge>Open</Badge>
                    )}
                    <form action={deleteSlot}>
                      <input type="hidden" name="slotId" value={s.id} />
                      <button className="text-xs text-zinc-500 hover:text-red-600">Remove</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Schedule a session</h2>
            <form action={createSession} className="space-y-3">
              <input type="hidden" name="courseId" value={course.id} />
              <Field>
                <Label htmlFor="ls-title">Title</Label>
                <Input id="ls-title" name="title" required maxLength={140} placeholder="Q&A: module 2" />
              </Field>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <Field>
                  <Label htmlFor="ls-start">Starts</Label>
                  <Input id="ls-start" name="startsAt" type="datetime-local" required />
                </Field>
                <Field>
                  <Label htmlFor="ls-dur">Minutes</Label>
                  <Input id="ls-dur" name="durationMin" type="number" min={5} max={600} defaultValue={60} />
                </Field>
              </div>
              <Field>
                <Label htmlFor="ls-join" hint="Zoom, Meet, Teams…">
                  Join URL
                </Label>
                <Input id="ls-join" name="joinUrl" type="url" placeholder="https://meet.example.com/abc" />
              </Field>
              <Field>
                <Label htmlFor="ls-cohort">Audience</Label>
                <Select id="ls-cohort" name="cohortId" defaultValue="" className="w-full">
                  <option value="">Everyone enrolled</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label htmlFor="ls-desc">Description</Label>
                <Textarea id="ls-desc" name="description" rows={3} placeholder="What we'll cover, what to prepare" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="invite" defaultChecked className="h-5 w-5" /> Notify learners and email a calendar invite
              </label>
              <SubmitButton pendingText="Scheduling…">Schedule session</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Open office-hour slots</h2>
            <form action={createOfficeHours} className="space-y-3">
              <input type="hidden" name="courseId" value={course.id} />
              <Field>
                <Label htmlFor="oh-start">First slot starts</Label>
                <Input id="oh-start" name="startsAt" type="datetime-local" required />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field>
                  <Label htmlFor="oh-min">Minutes per slot</Label>
                  <Input id="oh-min" name="slotMinutes" type="number" min={5} max={120} defaultValue={20} />
                </Field>
                <Field>
                  <Label htmlFor="oh-count">Number of slots</Label>
                  <Input id="oh-count" name="count" type="number" min={1} max={24} defaultValue={3} />
                </Field>
              </div>
              <SubmitButton pendingText="Creating…" variant="secondary">
                Create slots
              </SubmitButton>
            </form>
            <p className="mt-2 text-xs text-zinc-500">Learners book one slot each from the course page; you get a notification.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
