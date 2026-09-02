/**
 * Dependency-free HTTP load test for the read paths (NFR-7 / goal G4).
 *   node scripts/loadtest.mjs [--base http://localhost:3100] [--conc 50] [--seconds 15] [--signed-in]
 * Hits a weighted mix: catalog, search, course landing, paths, health; with --signed-in also the
 * lesson player and My Learning (session cookie minted like scripts/smoke.mjs).
 * Reports requests/s and latency percentiles per route and overall. Run against `next start`,
 * not the dev server — dev-mode numbers are meaningless.
 */
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : dflt;
};
const BASE = arg("base", process.env.BASE || "http://localhost:3100");
const CONC = Number(arg("conc", "50"));
const SECONDS = Number(arg("seconds", "15"));
const SIGNED_IN = process.argv.includes("--signed-in");
const SECRET = process.env.SESSION_SECRET || "dev-only-change-me-in-production";

const db = new PrismaClient();
const course = await db.course.findFirst({ where: { slug: "intro-to-online-teaching" }, include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } } });
if (!course) {
  console.error("Seed the database first (npm run db:seed).");
  process.exit(1);
}
const lesson = course.modules[0].lessons[0];

let cookie = "";
if (SIGNED_IN) {
  const u = await db.user.findUnique({ where: { email: "learner@example.com" } });
  const t = await new SignJWT({ sub: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d").sign(new TextEncoder().encode(SECRET));
  cookie = `el_session=${t}`;
}
await db.$disconnect();

const routes = [
  { name: "catalog", path: "/", weight: 3 },
  { name: "search", path: "/?q=teaching", weight: 2 },
  { name: "landing", path: `/courses/${course.slug}`, weight: 3 },
  { name: "paths", path: "/paths", weight: 1 },
  { name: "health", path: "/api/health", weight: 1 },
  ...(SIGNED_IN
    ? [
        { name: "lesson", path: `/learn/${course.slug}/${lesson.id}`, weight: 3 },
        { name: "my-learning", path: "/learn", weight: 2 },
      ]
    : []),
];
const bag = routes.flatMap((r) => Array(r.weight).fill(r));
const stats = new Map(routes.map((r) => [r.name, { count: 0, errors: 0, lat: [] }]));

console.log(`Load test → ${BASE} · ${CONC} connections · ${SECONDS}s · ${SIGNED_IN ? "signed-in" : "anonymous"} mix`);
const deadline = Date.now() + SECONDS * 1000;
let inFlightErrors = 0;

async function worker() {
  while (Date.now() < deadline) {
    const r = bag[Math.floor(Math.random() * bag.length)];
    const s = stats.get(r.name);
    const t0 = performance.now();
    try {
      const res = await fetch(BASE + r.path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
      await res.arrayBuffer();
      s.lat.push(performance.now() - t0);
      s.count++;
      if (res.status >= 400) s.errors++;
    } catch {
      s.errors++;
      inFlightErrors++;
      if (inFlightErrors > 200) return; // server is down — stop hammering
    }
  }
}

const t0 = Date.now();
await Promise.all(Array.from({ length: CONC }, worker));
const elapsed = (Date.now() - t0) / 1000;

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
let total = 0;
let allLat = [];
console.log(`\n${"route".padEnd(12)} ${"req".padStart(7)} ${"req/s".padStart(8)} ${"p50 ms".padStart(8)} ${"p95 ms".padStart(8)} ${"p99 ms".padStart(8)} ${"errors".padStart(7)}`);
for (const r of routes) {
  const s = stats.get(r.name);
  total += s.count;
  allLat = allLat.concat(s.lat);
  console.log(`${r.name.padEnd(12)} ${String(s.count).padStart(7)} ${(s.count / elapsed).toFixed(1).padStart(8)} ${pct(s.lat, 50).toFixed(0).padStart(8)} ${pct(s.lat, 95).toFixed(0).padStart(8)} ${pct(s.lat, 99).toFixed(0).padStart(8)} ${String(s.errors).padStart(7)}`);
}
console.log(`${"TOTAL".padEnd(12)} ${String(total).padStart(7)} ${(total / elapsed).toFixed(1).padStart(8)} ${pct(allLat, 50).toFixed(0).padStart(8)} ${pct(allLat, 95).toFixed(0).padStart(8)} ${pct(allLat, 99).toFixed(0).padStart(8)}`);
