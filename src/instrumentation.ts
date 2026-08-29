/**
 * Next.js instrumentation hook (v1.4): every unhandled server error is reported through
 * `reportError` (structured log + optional ERROR_REPORT_URL).
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const { reportError } = await import("./lib/log");
  await reportError(err, { path: request.path, method: request.method, route: context.routePath, routeType: context.routeType });
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { log } = await import("./lib/log");
    log.info("e-learner starting", { node: process.version, env: process.env.NODE_ENV, storage: process.env.S3_BUCKET ? "s3" : "local", redis: !!process.env.REDIS_URL });
  }
}
