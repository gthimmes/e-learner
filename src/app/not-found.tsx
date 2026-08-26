import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-5xl">🔍</div>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-500">The course or page you&apos;re looking for doesn&apos;t exist or isn&apos;t published.</p>
      <div className="mt-6">
        <LinkButton href="/">Back to catalog</LinkButton>
      </div>
    </div>
  );
}
