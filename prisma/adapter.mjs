// Prisma 7 driver adapter factory: Postgres when DATABASE_URL is postgres://,
// SQLite (better-sqlite3) otherwise. Used by src/lib/db.ts, the seed and scripts.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl, isPostgres, sqliteFilePath } from "./db-url.mjs";

export function createAdapter() {
  const url = databaseUrl();
  if (isPostgres(url)) return new PrismaPg({ connectionString: url });
  return new PrismaBetterSqlite3({ url: sqliteFilePath(url) });
}
