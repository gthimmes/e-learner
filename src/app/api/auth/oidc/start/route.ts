import { NextResponse } from "next/server";
import { beginLogin, oidcEnabled } from "@/lib/oidc";

/** GET /api/auth/oidc/start?next=/path → redirects to the identity provider. */
export async function GET(req: Request) {
  if (!oidcEnabled()) return new Response("SSO is not configured", { status: 404 });
  const next = new URL(req.url).searchParams.get("next") || "/learn";
  const url = await beginLogin(next);
  return NextResponse.redirect(url, { status: 302 });
}
