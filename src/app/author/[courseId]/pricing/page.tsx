import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourseForAuthor } from "@/lib/courses";
import { deleteCoupon, refundPurchase, toggleCoupon } from "@/lib/actions/commerce";
import { formatMoney, payments } from "@/lib/payments";
import { CouponForm } from "@/components/CommerceForms";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Pricing & sales" };

export default async function PricingPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole(`/author/${courseId}/pricing`, "INSTRUCTOR", "ADMIN");
  const course = await getCourseForAuthor(courseId, user);
  if (!course) notFound();
  const [purchases, coupons] = await Promise.all([
    db.purchase.findMany({ where: { courseId }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } }),
    db.coupon.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } }),
  ]);
  const paid = purchases.filter((p) => p.status === "PAID");
  const revenue = paid.reduce((s, p) => s + p.amountCents, 0);
  const refunded = purchases.filter((p) => p.status === "REFUNDED").reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title={`Pricing & sales · ${course.title}`}
        subtitle={course.priceCents ? `Priced at ${formatMoney(course.priceCents, course.currency)} — set under Details in the editor.` : "This course is free. Set a price under Details in the editor to sell it."}
        actions={
          <LinkButton href={`/author/${course.id}`} variant="secondary">
            ← Back to editor
          </LinkButton>
        }
      />
      {payments.name === "mock" ? (
        <div className="mb-6">
          <Alert tone="info">Payments run in test mode (in-app mock checkout). Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to take real payments.</Alert>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-8">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Sales", String(paid.length)],
              ["Revenue", formatMoney(revenue, course.currency)],
              ["Refunded", formatMoney(refunded, course.currency)],
            ].map(([label, value]) => (
              <Card key={label}>
                <div className="text-xs text-zinc-500">{label}</div>
                <div className="text-xl font-semibold">{value}</div>
              </Card>
            ))}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Purchases</h2>
            {purchases.length === 0 ? (
              <EmptyState title="No purchases yet" body="Purchases appear here once learners buy the course." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                    <tr>
                      <th className="px-4 py-3">Learner</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {purchases.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.user.name}</div>
                          <div className="text-xs text-zinc-500">{p.user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(p.amountCents, p.currency)}
                          {p.couponCode ? <span className="ml-1 text-xs text-zinc-500">({p.couponCode})</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={p.status === "PAID" ? "success" : p.status === "REFUNDED" ? "warning" : "neutral"}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{formatDate(p.paidAt ?? p.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {p.status === "PAID" ? (
                            <form action={refundPurchase}>
                              <input type="hidden" name="purchaseId" value={p.id} />
                              <SubmitButton variant="ghost" size="sm" pendingText="Refunding…">
                                Refund
                              </SubmitButton>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">New coupon</h2>
            <CouponForm courseId={course.id} />
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Coupons</h2>
            {coupons.length === 0 ? <p className="mt-1 text-xs text-zinc-500">No coupons yet.</p> : null}
            <ul className="mt-2 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {coupons.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <code className="font-semibold">{c.code}</code> <span className="text-zinc-500">{c.percentOff}% off</span>
                    <div className="text-xs text-zinc-500">
                      {c.uses}
                      {c.maxUses ? `/${c.maxUses}` : ""} used{c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleCoupon}>
                      <input type="hidden" name="couponId" value={c.id} />
                      <input type="hidden" name="active" value={c.active ? "on" : ""} />
                      <button className="text-xs text-indigo-600 hover:underline">{c.active ? "Disable" : "Enable"}</button>
                    </form>
                    <form action={deleteCoupon}>
                      <input type="hidden" name="couponId" value={c.id} />
                      <button className="text-xs text-zinc-400 hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
