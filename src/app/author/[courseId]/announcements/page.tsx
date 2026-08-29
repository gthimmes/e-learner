import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor } from "@/lib/courses";
import { getAnnouncements } from "@/lib/engage";
import { createAnnouncement, deleteAnnouncement } from "@/lib/actions/engage";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Field, Input, Label, LinkButton, PageHeader, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/announcements`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const items = await getAnnouncements(courseId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 text-sm text-zinc-500">
        <Link href={`/author/${course.id}`} className="hover:underline">
          {course.title}
        </Link>{" "}
        / Announcements
      </div>
      <PageHeader
        title="Announcements"
        subtitle={`Posted to every enrolled learner (${course._count.enrollments}) as an in-app notification, optionally by email.`}
        actions={
          <LinkButton href={`/author/${course.id}`} variant="secondary">
            ← Back to editor
          </LinkButton>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {items.length === 0 ? <p className="text-sm text-zinc-500">No announcements yet.</p> : null}
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{a.title}</h2>
                  <div className="text-xs text-zinc-500">
                    {a.author.name} · {formatDate(a.createdAt)} {a.emailed ? <Badge tone="info">emailed</Badge> : null}
                  </div>
                </div>
                <form action={deleteAnnouncement}>
                  <input type="hidden" name="announcementId" value={a.id} />
                  <button className="text-xs text-zinc-500 hover:text-red-600">Delete</button>
                </form>
              </div>
              {a.body ? (
                <div className="mt-3">
                  <Markdown>{a.body}</Markdown>
                </div>
              ) : null}
            </Card>
          ))}
        </section>

        <aside>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">New announcement</h2>
            <form action={createAnnouncement} className="space-y-3">
              <input type="hidden" name="courseId" value={course.id} />
              <Field>
                <Label htmlFor="ann-title">Title</Label>
                <Input id="ann-title" name="title" required maxLength={140} placeholder="Office hours this Friday" />
              </Field>
              <Field>
                <Label htmlFor="ann-body" hint="Markdown">
                  Message
                </Label>
                <Textarea id="ann-body" name="body" rows={6} placeholder="Drop into the Q&A session at 3 pm…" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="email" /> Also send by email
              </label>
              <SubmitButton pendingText="Posting…">Post announcement</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
