// Usage: npm run dev -- --port 3100 && npm run db:seed && node scripts/smoke.mjs
// HTTP smoke test against the running dev server. Mints session cookies directly.
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE || "http://localhost:3100";
const secret = new TextEncoder().encode("dev-only-change-me-in-production");
const db = new PrismaClient();

async function cookieFor(email) {
  const u = await db.user.findUnique({ where: { email } });
  const t = await new SignJWT({ sub: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d").sign(secret);
  return `el_session=${t}`;
}

let failures = 0;
async function check(name, url, { cookie, expect = 200, contains = [], method = "GET", body, headers = {} } = {}) {
  const res = await fetch(BASE + url, { method, body, redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...headers } });
  const text = (await res.text()).replace(/<!-- -->/g, "");
  const missing = contains.filter((c) => !text.includes(c));
  const ok = res.status === expect && missing.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} [${res.status}${res.headers.get("location") ? " → " + res.headers.get("location") : ""}]${missing.length ? " missing: " + JSON.stringify(missing) : ""}`);
  return { res, text };
}

const course = await db.course.findUnique({ where: { slug: "intro-to-online-teaching" }, include: { modules: { include: { lessons: true }, orderBy: { position: "asc" } } } });
const lesson0 = course.modules[0].lessons[0];
const videoLesson = course.modules[0].lessons[1];
const instructor = await cookieFor("instructor@example.com");
const learner = await cookieFor("learner@example.com");
const admin = await cookieFor("admin@example.com");

// Public
await check("catalog (anon)", "/", { contains: ["Course catalog", "Introduction to Online Teaching", "Get started"] });
await check("course landing (anon)", `/courses/${course.slug}`, { contains: ["Sign in to enroll", "Course outline", "Getting started"] });
await check("login page", "/login", { contains: ["Welcome back"] });
await check("register page", "/register", { contains: ["Create your account"] });
await check("404", "/courses/nope", { expect: 404, contains: ["Page not found"] });
await check("learn redirects anon", "/learn", { expect: 307 });
await check("author redirects anon", "/author", { expect: 307 });
await check("admin denied for learner", "/admin/users", { cookie: learner, expect: 307 });
await check("author denied for learner", "/author", { cookie: learner, expect: 307 });

// Learner
await check("my learning", "/learn", { cookie: learner, contains: ["My Learning", "Introduction to Online Teaching", "1/6 lessons"] });
await check("resume redirect", `/learn/${course.slug}`, { cookie: learner, expect: 307 });
await check("lesson player (text)", `/learn/${course.slug}/${lesson0.id}`, { cookie: learner, contains: ["Welcome!", "Completed", "Mark incomplete", "Next:"] });
await check("lesson player (video embed)", `/learn/${course.slug}/${videoLesson.id}`, { cookie: learner, contains: ["youtube-nocookie.com/embed/dQw4w9WgXcQ", "Mark complete"] });
await check("course landing (enrolled)", `/courses/${course.slug}`, { cookie: learner, contains: ["Your progress", "17%"] });
await check("done page", `/learn/${course.slug}/done`, { cookie: learner, contains: ["Almost there"] });

// Instructor
await check("author dashboard", "/author", { cookie: instructor, contains: ["Your courses", "Introduction to Online Teaching", "Published"] });
await check("course editor", `/author/${course.id}`, { cookie: instructor, contains: ["Outline", "Add lesson", "Add module", "Unpublish", "Danger zone"] });
await check("lesson editor", `/author/${course.id}/lessons/${videoLesson.id}`, { cookie: instructor, contains: ["Save lesson", "youtube.com/watch", "Move to module"] });
await check("learners", `/author/${course.id}/learners`, { cookie: instructor, contains: ["Lee Learner", "1/6"] });
await check("new course", "/author/new", { cookie: instructor, contains: ["Create a course"] });
await check("author preview", `/learn/${course.slug}/${lesson0.id}`, { cookie: instructor, contains: ["Author preview"] });

// Admin
await check("admin users", "/admin/users", { cookie: admin, contains: ["Ada Admin", "Ian Instructor", "Lee Learner", "(you)"] });
await check("admin sees all courses", "/author", { cookie: admin, contains: ["by Ian Instructor"] });

// Upload + media streaming
const fd = new FormData();
fd.append("file", new Blob([Buffer.from("hello media range test 0123456789")], { type: "text/plain" }), "notes.txt");
const up = await check("upload (instructor)", "/api/upload", { cookie: instructor, method: "POST", body: fd, contains: ['"url":"/api/media/'] });
const { url } = JSON.parse(up.text);
await check("media full", url, { contains: ["hello media range test"] });
const r = await check("media range", url, { expect: 206, headers: { range: "bytes=6-10" }, contains: ["media"] });
console.log("   content-range:", r.res.headers.get("content-range"));
const badFd = new FormData();
badFd.append("file", new Blob(["x"], { type: "application/x-msdownload" }), "evil.exe");
await check("upload rejects type", "/api/upload", { cookie: instructor, method: "POST", body: badFd, expect: 415 });
const fd2 = new FormData();
fd2.append("file", new Blob(["x"], { type: "text/plain" }), "a.txt");
await check("upload denied for learner", "/api/upload", { cookie: learner, method: "POST", body: fd2, expect: 403 });
await check("media traversal blocked", "/api/media/..%2F..%2Fpackage.json", { expect: 400 });

await db.$disconnect();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
