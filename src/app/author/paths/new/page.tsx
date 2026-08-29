import { requireRole } from "@/lib/auth";
import { PathForm } from "@/components/PathForms";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "New learning path" };

export default async function NewPathPage() {
  await requireRole("/author/paths/new", "INSTRUCTOR", "ADMIN");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="New learning path" subtitle="Give it a name — you'll add courses on the next screen." />
      <Card>
        <PathForm mode="create" />
      </Card>
    </div>
  );
}
