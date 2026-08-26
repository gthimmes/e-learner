import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { oidcEnabled, oidcLabel } from "@/lib/oidc";
import { AuthForm } from "@/components/AuthForm";
import { Alert, Card } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(next && next.startsWith("/") ? next : "/learn");
  const sso = oidcEnabled();
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-semibold">Welcome back</h1>
      <Card>
        {error ? (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        {sso ? (
          <div className="mb-5">
            <a
              href={`/api/auth/oidc/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              🔐 {oidcLabel()}
            </a>
            <div className="my-4 flex items-center gap-3 text-xs text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              or with email
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ) : null}
        <AuthForm mode="login" next={next} />
      </Card>
    </div>
  );
}
