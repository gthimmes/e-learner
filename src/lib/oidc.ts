import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { appUrl } from "./mail";

/**
 * Minimal OpenID Connect client (authorization code + PKCE) for SSO (AUTH-7).
 * Works with any standards-compliant IdP (Okta, Entra ID, Auth0, Keycloak, Google…).
 * Configure with OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET; optional OIDC_SCOPES,
 * OIDC_ORG_SLUG (auto-join an organization) and OIDC_BUTTON_LABEL.
 */
export const OIDC_COOKIE = "el_oidc";

export function oidcEnabled() {
  return !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID);
}

export const oidcLabel = () => process.env.OIDC_BUTTON_LABEL || "Sign in with SSO";

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
};

let cached: { at: number; doc: Discovery } | null = null;
export async function discover(): Promise<Discovery> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.doc;
  const issuer = process.env.OIDC_ISSUER!.replace(/\/$/, "");
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: "no-store" });
  if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
  const doc = (await res.json()) as Discovery;
  cached = { at: Date.now(), doc };
  return doc;
}

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);
const b64url = (b: Buffer) => b.toString("base64url");

export const redirectUri = () => appUrl("/api/auth/oidc/callback");

/** Builds the IdP authorization URL and stores state/nonce/verifier in a short-lived signed cookie. */
export async function beginLogin(next: string) {
  const doc = await discover();
  const state = b64url(randomBytes(16));
  const nonce = b64url(randomBytes(16));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());

  const token = await new SignJWT({ state, nonce, verifier, next })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secret());
  const jar = await cookies();
  jar.set(OIDC_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });

  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.OIDC_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("scope", process.env.OIDC_SCOPES || "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export type OidcIdentity = { subject: string; email: string; name: string };

/** Validates state, exchanges the code, verifies the ID token and returns the identity. */
export async function completeLogin(code: string, state: string): Promise<{ identity: OidcIdentity; next: string }> {
  const jar = await cookies();
  const raw = jar.get(OIDC_COOKIE)?.value;
  jar.delete(OIDC_COOKIE);
  if (!raw) throw new Error("Sign-in session expired. Try again.");
  const { payload } = await jwtVerify(raw, secret());
  if (payload.state !== state) throw new Error("Invalid state.");

  const doc = await discover();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: process.env.OIDC_CLIENT_ID!,
    code_verifier: String(payload.verifier),
  });
  if (process.env.OIDC_CLIENT_SECRET) body.set("client_secret", process.env.OIDC_CLIENT_SECRET);
  const res = await fetch(doc.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}).`);
  const tokens = (await res.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) throw new Error("IdP did not return an ID token.");

  const jwks = createRemoteJWKSet(new URL(doc.jwks_uri));
  const { payload: claims } = await jwtVerify(tokens.id_token, jwks, { issuer: doc.issuer, audience: process.env.OIDC_CLIENT_ID! });
  if (claims.nonce !== payload.nonce) throw new Error("Invalid nonce.");

  let email = typeof claims.email === "string" ? claims.email : "";
  let name = typeof claims.name === "string" ? claims.name : "";
  if ((!email || !name) && doc.userinfo_endpoint && tokens.access_token) {
    const ui = await fetch(doc.userinfo_endpoint, { headers: { authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
    if (ui.ok) {
      const info = (await ui.json()) as { email?: string; name?: string };
      email ||= info.email ?? "";
      name ||= info.name ?? "";
    }
  }
  if (!email) throw new Error("The identity provider did not share an email address.");
  const next = typeof payload.next === "string" && payload.next.startsWith("/") && !payload.next.startsWith("//") ? payload.next : "/learn";
  return { identity: { subject: String(claims.sub), email: email.toLowerCase(), name: name || email.split("@")[0]! }, next };
}
