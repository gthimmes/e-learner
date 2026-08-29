import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLearnerContext } from "@/lib/learning";
import { Card, LinkButton } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Course complete" };

export default async function CourseDonePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/learn/${slug}/done`);
  const ctx = await getLearnerContext(user.id, slug);
  if (!ctx) notFound();
  if (!ctx.enrollment) redirect(`/courses/${slug}`);
  const complete = !!ctx.enrollment.completedAt;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <Card className="p-10">
        <div className="text-5xl">{complete ? "🎉" : "📚"}</div>
        <h1 className="mt-4 text-2xl font-semibold">{complete ? "Course complete!" : "Almost there"}</h1>
        <p className="mt-2 text-zinc-500">
          {complete
            ? `You finished “${ctx.course.title}” on ${formatDate(ctx.enrollment.completedAt)}.`
            : `You've completed ${ctx.progressPct}% of “${ctx.course.title}”. Finish the remaining lessons to complete the course.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {complete ? <LinkButton href={`/learn/${slug}/certificate`}>🎓 View certificate</LinkButton> : null}
          {complete ? (
            <LinkButton href={`/courses/${slug}#reviews`} variant="secondary">
              ★ Rate this course
            </LinkButton>
          ) : null}
          <LinkButton href="/learn" variant={complete ? "secondary" : "primary"}>
            My Learning
          </LinkButton>
          <LinkButton href={`/learn/${slug}`} variant="secondary">
            {complete ? "Review the course" : "Continue"}
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
