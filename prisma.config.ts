import "dotenv/config";
import { defineConfig } from "prisma/config";
import { cliDatasourceUrl } from "./prisma/db-url.mjs";

// Prisma 7 config. `--schema prisma/postgres/schema.prisma` still selects the
// Postgres schema (and its sibling migrations folder) for the pg:* scripts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: cliDatasourceUrl(),
  },
});
