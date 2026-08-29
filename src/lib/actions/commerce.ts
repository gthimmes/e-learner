"use server";

import { audit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionAuthor, actionUser, getCurrentUser } from "@/lib/auth";
import { accessSelect, assertCourseAccess, canViewCourse } from "@/lib/courses";
import { applyDiscount, checkoutUrls, finalizePurchase, payments, validateCoupon } from "@/lib/payments";
import { formStr, formBool } from "@/lib/validation";
import type { RosterState } from "./roster";

export type CheckoutState = { error?: string };

/** Learner starts a purchase: validates coupon, creates a PENDING purchase and redirects to checkout. */
export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const courseId = formStr(formData, "courseId");
  const code = formStr(formData, "coupon").trim().toUpperCase();
  const user = await getCurrentUser();
  const course = await db.course.findUnique({ where: { id: courseId }, select: { ...accessSelect, status: true, title: true, priceCents: true, currency: true } });
  if (!course) return { error: "Course not found." };
  if (!user) redirect(`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`);
  if (!canViewCourse(user, course) || course.status !== "PUBLISHED") return { error: "This course is not open for enrollment." };

  const already = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (already) redirect(`/learn/${course.slug}`);

  let amount = course.priceCents;
  let couponCode: string | null = null;
  if (code) {
    const v = await validateCoupon(code, courseId);
    if ("error" in v) return { error: v.error };
    amount = applyDiscount(amount, v.coupon.percentOff);
    couponCode = v.coupon.code;
  }

  const purchase = await db.purchase.create({
    data: { userId: user.id, courseId, amountCents: amount, currency: course.currency, provider: payments.name, couponCode },
  });

  if (amount === 0) {
    await finalizePurchase(purchase.id, null); // 100 % coupon or free course
    revalidatePath("/learn");
    redirect(`/learn/${course.slug}`);
  }

  const { successUrl, cancelUrl } = checkoutUrls(course.slug);
  const session = await payments.createCheckout({
    purchaseId: purchase.id,
    amountCents: amount,
    currency: course.currency,
    title: course.title,
    email: user.email,
    successUrl,
    cancelUrl,
  });
  await db.purchase.update({ where: { id: purchase.id }, data: { providerSessionId: session.sessionId } });
  redirect(session.url);
}

/** Mock provider only: the in-app checkout page "pays". */
export async function completeMockCheckout(formData: FormData) {
  if (payments.name !== "mock") throw new Error("Mock checkout is disabled when Stripe is configured.");
  const user = await actionUser();
  const purchaseId = formStr(formData, "purchaseId");
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId }, include: { course: { select: { slug: true } } } });
  if (!purchase || purchase.userId !== user.id) throw new Error("Purchase not found.");
  if (purchase.status === "PENDING") await finalizePurchase(purchaseId, `mockpay_${purchaseId}`);
  revalidatePath("/learn");
  redirect(`/courses/${purchase.course.slug}?purchase=success&session_id=${purchase.providerSessionId ?? ""}`);
}

/** Course editor refunds a paid purchase and removes the enrollment. */
export async function refundPurchase(formData: FormData) {
  const user = await actionAuthor();
  const purchaseId = formStr(formData, "purchaseId");
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) throw new Error("Purchase not found.");
  await assertCourseAccess(purchase.courseId, user);
  if (purchase.status !== "PAID") throw new Error("Only paid purchases can be refunded.");
  if (purchase.providerPaymentId) await payments.refund(purchase.providerPaymentId);
  await db.$transaction([
    db.purchase.update({ where: { id: purchaseId }, data: { status: "REFUNDED", refundedAt: new Date() } }),
    db.enrollment.deleteMany({ where: { userId: purchase.userId, courseId: purchase.courseId } }),
  ]);
  await audit(user, "purchase.refund", { type: "purchase", id: purchaseId }, { amountCents: purchase.amountCents, currency: purchase.currency, userId: purchase.userId });
  revalidatePath(`/author/${purchase.courseId}/pricing`);
  revalidatePath(`/author/${purchase.courseId}/learners`);
}

// ---------- Coupons ----------

export async function createCoupon(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const user = await actionAuthor();
  const courseId = formStr(formData, "courseId");
  await assertCourseAccess(courseId, user);
  const code = formStr(formData, "code").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const percentOff = Math.round(Number(formStr(formData, "percentOff")));
  const maxUses = Math.max(0, Math.round(Number(formStr(formData, "maxUses")) || 0));
  const expires = formStr(formData, "expiresAt");
  if (code.length < 3) return { error: "Code must be at least 3 characters (letters, numbers, hyphens)." };
  if (!(percentOff >= 1 && percentOff <= 100)) return { error: "Discount must be between 1 and 100 percent." };
  if (await db.coupon.findUnique({ where: { code } })) return { error: "That code already exists." };
  await db.coupon.create({
    data: { code, percentOff, maxUses, courseId, createdById: user.id, expiresAt: expires ? new Date(expires) : null },
  });
  revalidatePath(`/author/${courseId}/pricing`);
  return { message: `Coupon ${code} created (${percentOff}% off).` };
}

export async function toggleCoupon(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "couponId");
  const c = await db.coupon.findUnique({ where: { id } });
  if (!c || !c.courseId) throw new Error("Coupon not found.");
  await assertCourseAccess(c.courseId, user);
  await db.coupon.update({ where: { id }, data: { active: !formBool(formData, "active") } });
  revalidatePath(`/author/${c.courseId}/pricing`);
}

export async function deleteCoupon(formData: FormData) {
  const user = await actionAuthor();
  const id = formStr(formData, "couponId");
  const c = await db.coupon.findUnique({ where: { id } });
  if (!c || !c.courseId) throw new Error("Coupon not found.");
  await assertCourseAccess(c.courseId, user);
  await db.coupon.delete({ where: { id } });
  revalidatePath(`/author/${c.courseId}/pricing`);
}
