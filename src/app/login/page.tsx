import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next && next.startsWith("/") ? next : "/learn");
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-semibold">Welcome back</h1>
      <Card>
        <AuthForm mode="login" next={next} />
      </Card>
    </div>
  );
}
