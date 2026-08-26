import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLearnerContext } from "@/lib/learning";
import { formatDate } from "@/lib/utils";
import { LinkButton } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Certificate" };

/** Printable certificate of completion (LEARN-10). Use the browser's Print → Save as PDF. */
export default async function CertificatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/learn/${slug}/certificate`);
  const ctx = await getLearnerContext(user.id, slug);
  if (!ctx) notFound();
  if (!ctx.enrollment?.completedAt) redirect(`/learn/${slug}/done`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <LinkButton href={`/learn/${slug}/done`} variant="secondary">
          ← Back
        </LinkButton>
        <PrintButton />
      </div>
      <div className="rounded-2xl border-8 border-double border-indigo-600 bg-white p-12 text-center text-zinc-900 print:border-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Certificate of completion</div>
        <div className="mt-8 text-sm text-zinc-500">This certifies that</div>
        <div className="mt-2 text-4xl font-semibold tracking-tight">{user.name}</div>
        <div className="mt-6 text-sm text-zinc-500">has successfully completed the course</div>
        <div className="mt-2 text-2xl font-semibold">{ctx.course.title}</div>
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-t border-zinc-300 pt-2 font-medium">{ctx.course.instructor.name}</div>
            <div className="text-zinc-500">Instructor</div>
          </div>
          <div>
            <div className="border-t border-zinc-300 pt-2 font-medium">{formatDate(ctx.enrollment.completedAt)}</div>
            <div className="text-zinc-500">Date completed</div>
          </div>
        </div>
        <div className="mt-8 text-[10px] text-zinc-400">
          Certificate ID {ctx.enrollment.id} · issued by e-learner
        </div>
      </div>
    </div>
  );
}
