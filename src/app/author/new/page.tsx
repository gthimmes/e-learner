import { requireRole } from "@/lib/auth";
import { CourseForm } from "@/components/CourseForm";
import { Card, PageHeader } from "@/components/ui";
import { AiCourseForm } from "@/components/AiForms";
import { aiEnabled, aiProvider } from "@/lib/ai";

export const metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole("/author/new", "INSTRUCTOR", "ADMIN");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Create a course" subtitle={aiEnabled ? "Describe it and let the copilot draft the outline, lessons and quizzes — or start by hand." : "Start with a title. You can add modules and lessons next."} />
      {aiEnabled ? (
        <Card className="mb-6 border-indigo-200 dark:border-indigo-900">
          <h2 className="mb-3 text-lg font-semibold">✨ Draft with AI</h2>
          <AiCourseForm provider={aiProvider.name} />
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">{aiEnabled ? "Or start by hand" : "Course details"}</h2>
        <CourseForm mode="create" />
      </Card>
    </div>
  );
}
