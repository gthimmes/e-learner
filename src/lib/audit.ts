import "server-only";
import { db } from "./db";
import { log } from "./log";

export type Actor = { id: string; email: string } | null;

/** Append-only record of privileged actions (v1.4). Never throws — auditing must not break the action. */
export async function audit(actor: Actor, action: string, target?: { type: string; id: string }, meta: Record<string, unknown> = {}) {
  try {
    await db.auditLog.create({
      data: { actorId: actor?.id ?? null, actorEmail: actor?.email ?? "", action, targetType: target?.type ?? "", targetId: target?.id ?? "", meta: JSON.stringify(meta) },
    });
    log.info("audit", { action, actor: actor?.email, target: target ? `${target.type}:${target.id}` : undefined, ...meta });
  } catch (e) {
    log.error("audit write failed", { action, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function getAuditLog(limit = 200) {
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
