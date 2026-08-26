import { db } from "@/lib/db";
import { finalizePurchase, stripeProvider } from "@/lib/payments";

/** Stripe → POST /api/stripe/webhook. Handles checkout.session.completed and charge.refunded. */
export async function POST(req: Request) {
  const stripe = stripeProvider();
  if (!stripe) return new Response("Stripe is not configured", { status: 404 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const raw = await req.text();

  let event;
  try {
    event = stripe.parseWebhook(raw, signature);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const purchaseId = session.metadata?.purchaseId;
    if (purchaseId && session.payment_status === "paid") {
      await finalizePurchase(purchaseId, typeof session.payment_intent === "string" ? session.payment_intent : null);
    }
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (pi) {
      const purchase = await db.purchase.findFirst({ where: { providerPaymentId: pi, status: "PAID" } });
      if (purchase) {
        await db.$transaction([
          db.purchase.update({ where: { id: purchase.id }, data: { status: "REFUNDED", refundedAt: new Date() } }),
          db.enrollment.deleteMany({ where: { userId: purchase.userId, courseId: purchase.courseId } }),
        ]);
      }
    }
  }
  return new Response("ok");
}
