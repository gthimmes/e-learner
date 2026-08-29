import { bookSlot, cancelBooking, rsvp } from "@/lib/actions/live";
import type { getOfficeHours, getSessions } from "@/lib/live";
import { SubmitButton } from "./SubmitButton";
import { Badge, Input } from "./ui";
import { formatDate } from "@/lib/utils";

type Session = Awaited<ReturnType<typeof getSessions>>[number];
type Slot = Awaited<ReturnType<typeof getOfficeHours>>[number];
const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Learner-facing live sessions (RSVP, join, calendar) and office-hour booking on the course page (v2.2). */
export function LiveSessions({ sessions, slots, userId, canBook }: { sessions: Session[]; slots: Slot[]; userId: string | null; canBook: boolean }) {
  const upcoming = sessions.filter((s) => !s.isPast);
  const openSlots = slots.filter((s) => !s.bookedById);
  const mine = slots.filter((s) => s.bookedById === userId);
  if (upcoming.length === 0 && slots.length === 0) return null;

  return (
    <section id="live" className="mt-10">
      <h2 className="text-xl font-semibold">Live sessions</h2>
      {upcoming.length === 0 ? <p className="mt-2 text-sm text-zinc-500">No upcoming sessions.</p> : null}
      <ul className="mt-4 space-y-3">
        {upcoming.map((s) => (
          <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">
                  📅 {s.title} {s.isLive ? <Badge tone="success">Live now</Badge> : null}
                  {s.cohort ? <Badge tone="info">{s.cohort.name}</Badge> : null}
                </div>
                <div className="text-sm text-zinc-500">
                  {formatDate(s.startsAt)} · {time(s.startsAt)}–{time(s.endsAt)} · {s._count.rsvps} going
                </div>
                {s.description ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{s.description}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {s.joinUrl ? (
                  <a href={s.joinUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700">
                    Join
                  </a>
                ) : null}
                <a href={`/api/live/${s.id}.ics`} className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Add to calendar
                </a>
                {canBook ? (
                  <form action={rsvp} className="flex items-center gap-1">
                    <input type="hidden" name="sessionId" value={s.id} />
                    {(["GOING", "MAYBE", "NO"] as const).map((st) => (
                      <button
                        key={st}
                        name="status"
                        value={st}
                        className={s.myRsvp === st ? "rounded-lg px-2.5 py-1.5 text-xs font-medium text-white" : "rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}
                        style={s.myRsvp === st ? { background: "var(--brand)" } : undefined}
                        aria-pressed={s.myRsvp === st}
                      >
                        {st === "GOING" ? "Going" : st === "MAYBE" ? "Maybe" : "Can't"}
                      </button>
                    ))}
                  </form>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {slots.length > 0 ? (
        <div className="mt-6">
          <h3 className="font-semibold">Office hours</h3>
          {mine.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {mine.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                  <span>
                    ✅ Your slot: {formatDate(s.startsAt)} {time(s.startsAt)}–{time(s.endsAt)}
                    {s.note ? <span className="text-zinc-500"> · “{s.note}”</span> : null}
                  </span>
                  <form action={cancelBooking}>
                    <input type="hidden" name="slotId" value={s.id} />
                    <button className="text-xs text-zinc-500 hover:text-red-600">Cancel</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          {canBook && mine.length === 0 ? (
            openSlots.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">All slots are booked — check back later.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {openSlots.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <span>
                      {formatDate(s.startsAt)} {time(s.startsAt)}–{time(s.endsAt)}
                    </span>
                    <form action={bookSlot} className="flex items-center gap-2">
                      <input type="hidden" name="slotId" value={s.id} />
                      <Input name="note" placeholder="What do you want to discuss?" aria-label="Topic" className="w-56 py-1 text-xs" maxLength={300} />
                      <SubmitButton size="sm" pendingText="Booking…">
                        Book
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
