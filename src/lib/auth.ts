import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, type Role } from "./constants";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  if (process.env.NODE_ENV === "production" && s.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET must be changed for production");
  }
  return new TextEncoder().encode(s);
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
  orgAdmin: boolean;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Current user or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, organizationId: true, orgAdmin: true },
    });
    return user ? { ...user, role: user.role as Role } : null;
  } catch {
    return null;
  }
});

/** Redirects to /login (with return path) when signed out. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export function hasRole(user: SessionUser | null, ...roles: Role[]) {
  return !!user && roles.includes(user.role);
}

export const canAuthor = (user: SessionUser | null) => hasRole(user, "INSTRUCTOR", "ADMIN");
export const isAdmin = (user: SessionUser | null) => hasRole(user, "ADMIN");

export async function requireRole(next: string, ...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect("/?denied=1");
  return user;
}

/** Throw-style guards for server actions (no redirect side effects). */
export async function actionUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  return user;
}

export async function actionAuthor(): Promise<SessionUser> {
  const user = await actionUser();
  if (!canAuthor(user)) throw new Error("Instructor access required.");
  return user;
}

export async function actionAdmin(): Promise<SessionUser> {
  const user = await actionUser();
  if (!isAdmin(user)) throw new Error("Admin access required.");
  return user;
}
