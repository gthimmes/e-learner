import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { completeLogin, oidcEnabled } from "@/lib/oidc";
import { appUrl } from "@/lib/mail";

/**
 * GET /api/auth/oidc/callback?code=&state= → verifies the login, finds or creates the
 * user by email, optionally joins OIDC_ORG_SLUG, starts a session and redirects.
 */
export async function GET(req: Request) {
  if (!oidcEnabled()) return new Response("SSO is not configured", { status: 404 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const idpError = url.searchParams.get("error");
  const fail = (msg: string) => NextResponse.redirect(appUrl(`/login?error=${encodeURIComponent(msg)}`), { status: 302 });
  if (idpError) return fail(`Identity provider error: ${idpError}`);
  if (!code || !state) return fail("Missing code or state.");

  try {
    const { identity, next } = await completeLogin(code, state);

    let user = await db.user.findUnique({ where: { email: identity.email } });
    if (!user) {
      const userCount = await db.user.count();
      user = await db.user.create({
        data: {
          email: identity.email,
          name: identity.name,
          passwordHash: await hashPassword(randomBytes(32).toString("base64url")), // SSO-only; can be reset by email
          role: userCount === 0 ? "ADMIN" : "LEARNER",
        },
      });
    }

    const orgSlug = process.env.OIDC_ORG_SLUG;
    if (orgSlug && !user.organizationId) {
      const org = await db.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } });
      if (org) await db.user.update({ where: { id: user.id }, data: { organizationId: org.id } });
    }

    await createSession(user.id);
    return NextResponse.redirect(appUrl(next), { status: 302 });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "SSO sign-in failed.");
  }
}
