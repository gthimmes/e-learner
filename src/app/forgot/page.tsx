import { ForgotForm } from "@/components/PasswordForms";
import { Card } from "@/components/ui";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-center text-2xl font-semibold">Forgot your password?</h1>
      <p className="mb-6 text-center text-sm text-zinc-500">Enter your email and we&apos;ll send you a link to set a new one.</p>
      <Card>
        <ForgotForm />
      </Card>
    </div>
  );
}
