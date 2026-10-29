// Database URL helpers shared by the app, the Prisma CLI config, seeds and scripts.
// No adapter imports here so prisma.config.ts stays light.
import path from "node:path";

export function databaseUrl() {
  return process.env.DATABASE_URL ?? "file:./dev.db";
}

export function isPostgres(url = databaseUrl()) {
  return /^postgres(ql)?:/.test(url);
}

/** Absolute SQLite file path. Relative paths resolve against prisma/ (Prisma 6 behaviour). */
export function sqliteFilePath(url = databaseUrl()) {
  const p = url.replace(/^file:/, "");
  if (p === ":memory:" || path.isAbsolute(p)) return p;
  return path.resolve(process.cwd(), "prisma", p);
}

/** URL for the Prisma CLI (migrate/db push): Postgres as-is, SQLite as an absolute file: URL. */
export function cliDatasourceUrl() {
  const url = databaseUrl();
  return isPostgres(url) ? url : `file:${sqliteFilePath(url)}`;
}
