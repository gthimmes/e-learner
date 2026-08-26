import "server-only";
import Stripe from "stripe";
import { db } from "./db";
import { appUrl } from "./mail";
import { emitEvent } from "./webhooks";

/**
 * Payment provider boundary (v1.0 commerce). `StripeProvider` is used when STRIPE_SECRET_KEY is
 * set; otherwise `MockProvider` renders an in-app checkout page so the flow works locally and in CI.
 */
export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export interface PaymentProvider {
  readonly name: "stripe" | "mock";
  createCheckout(p: { purchaseId: string; amountCents: number; currency: string; title: string; email: string; successUrl: string; cancelUrl: string }): Promise<CheckoutResult>;
  /** Returns the payment id when the session has been paid, else null. */
  verifySession(sessionId: string): Promise<{ paid: boolean; paymentId: string | null }>;
  refund(paymentId: string): Promise<void>;
}

class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;
  async createCheckout(p: { purchaseId: string }) {
    return { url: `/checkout/mock/${p.purchaseId}`, sessionId: `mock_${p.purchaseId}` };
  }
  async verifySession(sessionId: string) {
    const purchase = await db.purchase.findUnique({ where: { providerSessionId: sessionId }, select: { status: true, providerPaymentId: true } });
    return { paid: purchase?.status === "PAID", paymentId: purchase?.providerPaymentId ?? null };
  }
  async refund() {}
}

class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  async createCheckout(p: { purchaseId: string; amountCents: number; currency: string; title: string; email: string; successUrl: string; cancelUrl: string }) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: p.email,
      line_items: [{ quantity: 1, price_data: { currency: p.currency, unit_amount: p.amountCents, product_data: { name: p.title } } }],
      metadata: { purchaseId: p.purchaseId },
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
    });
    return { url: session.url!, sessionId: session.id };
  }
  async verifySession(sessionId: string) {
    const s = await this.stripe.checkout.sessions.retrieve(sessionId);
    return { paid: s.payment_status === "paid", paymentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null) };
  }
  async refund(paymentId: string) {
    await this.stripe.refunds.create({ payment_intent: paymentId });
  }
  /** Verifies and parses a webhook event. */
  parseWebhook(rawBody: string, signature: string) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  }
}

export const payments: PaymentProvider = process.env.STRIPE_SECRET_KEY ? new StripeProvider() : new MockProvider();
export const stripeProvider = () => (payments instanceof StripeProvider ? payments : null);

export function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** Looks up an active, unexpired, unexhausted coupon valid for the course. */
export async function validateCoupon(code: string, courseId: string) {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c || !c.active) return { error: "That coupon code is not valid." };
  if (c.expiresAt && c.expiresAt < new Date()) return { error: "That coupon has expired." };
  if (c.maxUses > 0 && c.uses >= c.maxUses) return { error: "That coupon has been fully redeemed." };
  if (c.courseId && c.courseId !== courseId) return { error: "That coupon is for a different course." };
  return { coupon: c };
}

export const applyDiscount = (cents: number, percentOff: number) => Math.max(0, Math.round(cents * (1 - percentOff / 100)));

/** Marks a purchase paid, enrolls the learner and bumps the coupon. Idempotent. */
export async function finalizePurchase(purchaseId: string, paymentId: string | null) {
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.status === "PAID") return purchase;
  const updated = await db.$transaction(async (tx) => {
    const p = await tx.purchase.update({ where: { id: purchaseId }, data: { status: "PAID", paidAt: new Date(), providerPaymentId: paymentId ?? undefined } });
    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: p.userId, courseId: p.courseId } },
      create: { userId: p.userId, courseId: p.courseId },
      update: {},
    });
    if (p.couponCode) await tx.coupon.updateMany({ where: { code: p.couponCode }, data: { uses: { increment: 1 } } });
    return p;
  });
  void emitEvent("enrollment.created", updated.courseId, updated.userId);
  return updated;
}

export const checkoutUrls = (slug: string) => ({
  successUrl: appUrl(`/courses/${slug}?purchase=success&session_id={CHECKOUT_SESSION_ID}`),
  cancelUrl: appUrl(`/courses/${slug}?purchase=canceled`),
});
