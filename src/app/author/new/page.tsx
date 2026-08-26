import { requireRole } from "@/lib/auth";
import { CourseForm } from "@/components/CourseForm";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole("/author/new", "INSTRUCTOR", "ADMIN");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Create a course" subtitle="Start with a title. You can add modules and lessons next." />
      <Card>
        <CourseForm mode="create" />
      </Card>
    </div>
  );
}
