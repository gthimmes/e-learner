import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthForm } from "@/components/AuthForm";
import { getT } from "@/lib/i18n";
import { Alert, Card } from "@/components/ui";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next && next.startsWith("/") ? next : "/learn");
  const firstUser = (await db.user.count()) === 0;
  const t = await getT();
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-semibold">{t("auth.createAccount")}</h1>
      <Card>
        {firstUser ? (
          <div className="mb-4">
            <Alert tone="info">You are the first user — this account will be the platform admin.</Alert>
          </div>
        ) : null}
        <AuthForm mode="register" next={next} />
      </Card>
    </div>
  );
}
