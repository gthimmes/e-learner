/**
 * Structured logging. JSON lines in production (one object per line, easy to ship to any log
 * collector); readable key=value lines in development. Never throws.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";
const minLevel: Level = (process.env.LOG_LEVEL as Level) || (isProd ? "info" : "debug");
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, msg: string, fields: Fields = {}) {
  if (order[level] < order[minLevel]) return;
  const rec = { ts: new Date().toISOString(), level, msg, ...fields };
  const line = isProd
    ? JSON.stringify(rec)
    : `${rec.ts} ${level.toUpperCase().padEnd(5)} ${msg}${Object.keys(fields).length ? " " + Object.entries(fields).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ") : ""}`;
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};

/**
 * Error reporting hook: logs the error and, when `ERROR_REPORT_URL` is set, POSTs a JSON
 * summary to it (Sentry-compatible collectors, Slack webhooks, or your own endpoint).
 */
export async function reportError(err: unknown, ctx: Fields = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  log.error(e.message, { ...ctx, stack: e.stack?.split("\n").slice(0, 8).join("\n") });
  const url = process.env.ERROR_REPORT_URL;
  if (!url) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app: "e-learner", ts: new Date().toISOString(), message: e.message, name: e.name, stack: e.stack, ...ctx }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
  } catch {
    /* never let reporting fail the request */
  }
}
