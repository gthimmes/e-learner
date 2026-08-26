import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeMockCheckout } from "@/lib/actions/commerce";
import { formatMoney, payments } from "@/lib/payments";
import { Alert, Card, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Checkout" };

/** In-app stand-in for the payment provider's hosted checkout (dev/CI only). */
export default async function MockCheckoutPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const user = await requireUser(`/checkout/mock/${purchaseId}`);
  if (payments.name !== "mock") notFound();
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId }, include: { course: { select: { title: true, slug: true } } } });
  if (!purchase || purchase.userId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <div className="mb-4">
          <Alert tone="info">Test checkout — no real payment is taken. Configure Stripe to use hosted checkout.</Alert>
        </div>
        <h1 className="text-xl font-semibold">{purchase.course.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Billed to {user.email}
          {purchase.couponCode ? ` · coupon ${purchase.couponCode}` : ""}
        </p>
        <div className="mt-4 text-3xl font-semibold">{formatMoney(purchase.amountCents, purchase.currency)}</div>
        {purchase.status === "PAID" ? (
          <div className="mt-6">
            <Alert tone="success">Already paid.</Alert>
            <LinkButton href={`/learn/${purchase.course.slug}`} className="mt-4 w-full">
              Go to course
            </LinkButton>
          </div>
        ) : (
          <form action={completeMockCheckout} className="mt-6 space-y-2">
            <input type="hidden" name="purchaseId" value={purchase.id} />
            <SubmitButton className="w-full" pendingText="Paying…">
              Pay {formatMoney(purchase.amountCents, purchase.currency)}
            </SubmitButton>
            <LinkButton href={`/courses/${purchase.course.slug}?purchase=canceled`} variant="ghost" className="w-full">
              Cancel
            </LinkButton>
          </form>
        )}
      </Card>
    </div>
  );
}
