// Removes artifacts left behind by Playwright specs / demo recordings in the local dev DB.
// Usage: node scripts/cleanup-test-data.mjs
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const courses = await db.course.deleteMany({
  where: { OR: [{ title: { startsWith: "E2E Course" } }, { title: { startsWith: "Discover Course" } }, { title: { startsWith: "Paid Course" } }, { title: { startsWith: "Assess Course" } }, { slug: { startsWith: "e2e-" } }, { slug: { startsWith: "disc-" } }, { slug: { startsWith: "paid-" } }] },
});
const paths = await db.learningPath.deleteMany({ where: { title: { startsWith: "Zebra Path" } } });
const users = await db.user.deleteMany({
  where: { OR: [{ email: { startsWith: "e2e-" } }, { email: { startsWith: "disc-" } }, { email: { startsWith: "buyer-" } }, { email: { startsWith: "assess-" } }, { email: { startsWith: "dana.demo" } }, { email: { startsWith: "sso-" } }, { email: { startsWith: "reset-" } }, { email: { startsWith: "newbie" } }, { email: { startsWith: "coauthor-" } }] },
});
const orgs = await db.organization.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
console.log({ courses: courses.count, paths: paths.count, users: users.count, orgs: orgs.count });
await db.$disconnect();
