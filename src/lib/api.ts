import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./auth";
import { userFromApiRequest } from "./apikeys";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Accepts an API key (Authorization: Bearer elk_…) or the browser session cookie. */
export async function apiUser(req: Request): Promise<SessionUser | null> {
  return (await userFromApiRequest(req)) ?? (await getCurrentUser());
}

export async function requireApiUser(req: Request): Promise<SessionUser> {
  const user = await apiUser(req);
  if (!user) throw new ApiError(401, "Unauthorized. Pass an API key as `Authorization: Bearer elk_…`.");
  return user;
}

/** Wraps a handler so thrown ApiErrors (and unexpected errors) become JSON responses. */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
    }
  };
}
