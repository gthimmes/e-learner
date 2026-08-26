import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import type { SessionUser } from "./auth";
import type { Role } from "./constants";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Generates a key like `elk_…` (shown once) and stores only its hash. */
export async function generateApiKey(userId: string, name: string) {
  const plaintext = `elk_${randomBytes(30).toString("base64url")}`;
  const key = await db.apiKey.create({
    data: { userId, name, prefix: plaintext.slice(0, 12), keyHash: sha(plaintext) },
  });
  return { key, plaintext };
}

/** Resolves `Authorization: Bearer elk_…` to the owning user, or null. */
export async function userFromApiRequest(req: Request): Promise<SessionUser | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(elk_[A-Za-z0-9_-]+)$/i);
  if (!m) return null;
  const key = await db.apiKey.findUnique({
    where: { keyHash: sha(m[1]!) },
    include: { user: { select: { id: true, email: true, name: true, role: true, organizationId: true, orgAdmin: true } } },
  });
  if (!key || key.revokedAt) return null;
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { ...key.user, role: key.user.role as Role };
}
