import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditCourse } from "@/lib/courses";
import { getLearnerContext, resumeLessonId } from "@/lib/learning";

/** /learn/[slug] → resume the right lesson (LEARN-6). */
export default async function LearnCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/learn/${slug}`);
  const ctx = await getLearnerContext(user.id, slug);
  if (!ctx) notFound();
  const isAuthor = canEditCourse(user, ctx.course);
  if (!ctx.enrollment && !isAuthor) redirect(`/courses/${slug}`);
  const lessonId = resumeLessonId(ctx);
  if (!lessonId) redirect(`/courses/${slug}`);
  redirect(`/learn/${slug}/${lessonId}`);
}
