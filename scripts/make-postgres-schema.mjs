/**
 * Generates prisma/postgres/schema.prisma from prisma/schema.prisma (identical models, Postgres
 * datasource) so the two can never drift. Run after any schema change:
 *   node scripts/make-postgres-schema.mjs           # regenerate
 *   node scripts/make-postgres-schema.mjs --check   # fail if out of date (CI)
 * The Postgres migration history lives in prisma/postgres/migrations (regenerate the init
 * migration with `npm run db:pg:diff` after model changes).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const HEADER = `// GENERATED from prisma/schema.prisma by scripts/make-postgres-schema.mjs — do not edit.
// Same models, Postgres datasource. Regenerate after any change to the main schema.
`;

const src = readFileSync("prisma/schema.prisma", "utf8");
const swapped = src.replace(
  /datasource db \{[^}]*\}/,
  'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}',
);
if (swapped === src) {
  console.error("Could not find the datasource block to swap.");
  process.exit(1);
}
const out = HEADER + swapped;

mkdirSync("prisma/postgres", { recursive: true });
const target = "prisma/postgres/schema.prisma";

if (process.argv.includes("--check")) {
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (current.replace(/\r\n/g, "\n") !== out.replace(/\r\n/g, "\n")) {
    console.error(`${target} is out of date. Run: node scripts/make-postgres-schema.mjs`);
    process.exit(1);
  }
  console.log(`${target} is in sync.`);
} else {
  writeFileSync(target, out);
  console.log(`Wrote ${target}.`);
}
