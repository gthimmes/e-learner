import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/driver packages used by the Prisma 7 adapters stay outside the bundle.
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "@prisma/adapter-pg", "better-sqlite3", "pg"],
};

export default nextConfig;
