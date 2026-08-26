import { ResetForm } from "@/components/PasswordForms";
import { Card } from "@/components/ui";

export const metadata = { title: "Reset password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-semibold">Choose a new password</h1>
      <Card>
        <ResetForm token={token} />
      </Card>
    </div>
  );
}
