import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourseForAuthor, getLessonForAuthor } from "@/lib/courses";
import { deleteLesson, moveLessonToModule } from "@/lib/actions/courses";
import { LessonForm } from "@/components/LessonForm";
import { QuestionEditor } from "@/components/QuestionEditor";
import { QuizStats } from "@/components/QuizStats";
import { Card, LinkButton, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Edit lesson" };

export default async function LessonEditorPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const user = await requireRole(`/author/${courseId}/lessons/${lessonId}`, "INSTRUCTOR", "ADMIN");
  const [course, lesson] = await Promise.all([getCourseForAuthor(courseId, user), getLessonForAuthor(lessonId, user)]);
  if (!course || !lesson || lesson.module.course.id !== course.id) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={lesson.title}
        subtitle={
          <>
            {course.title} · {lesson.module.title}
          </>
        }
        actions={
          <>
            <LinkButton href={`/learn/${course.slug}/${lesson.id}`} variant="secondary">
              Preview
            </LinkButton>
            <LinkButton href={`/author/${course.id}`} variant="secondary">
              ← Back to outline
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <Card>
            <LessonForm lesson={lesson} />
          </Card>
          {lesson.type === "QUIZ" ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Questions</h2>
              <QuestionEditor lessonId={lesson.id} questions={lesson.questions} />
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {lesson.type === "QUIZ" ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Quiz results</h2>
              <QuizStats lessonId={lesson.id} />
            </Card>
          ) : null}
          <Card>
            <h2 className="text-sm font-semibold">Move to module</h2>
            <form action={moveLessonToModule} className="mt-2 flex gap-2">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <Select name="moduleId" defaultValue={lesson.moduleId} className="flex-1" aria-label="Target module">
                {course.modules.map((m, i) => (
                  <option key={m.id} value={m.id}>
                    {i + 1}. {m.title}
                  </option>
                ))}
              </Select>
              <SubmitButton variant="secondary" size="sm" pendingText="…">
                Move
              </SubmitButton>
            </form>
          </Card>
          <Card className="border-red-200 dark:border-red-900">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Delete lesson</h2>
            <p className="mt-1 text-xs text-zinc-500">Learner progress for this lesson will be removed.</p>
            <form action={deleteLesson} className="mt-3">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <SubmitButton variant="danger" size="sm" pendingText="Deleting…">
                Delete lesson
              </SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
