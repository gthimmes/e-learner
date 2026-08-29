// Usage: npm run dev -- --port 3100 && npm run db:seed && node scripts/smoke.mjs
// HTTP smoke test against the running dev server. Mints session cookies directly.
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import http from "node:http";
import { createHash, createHmac, randomBytes } from "node:crypto";

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
const orgAdmin = await cookieFor("orgadmin@acme.example.com");
const orgStaff = await cookieFor("staff@acme.example.com");
const acme = await db.course.findUnique({ where: { slug: "acme-onboarding" } });

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

await check("forgot page", "/forgot", { contains: ["Send reset link"] });
await check("reset page (bad token renders form)", "/reset/not-a-token", { contains: ["Set new password"] });
await check("login has forgot link", "/login", { contains: ["Forgot password?"] });

// Learner
await check("my learning", "/learn", { cookie: learner, contains: ["My Learning", "Introduction to Online Teaching", "1/7 lessons"] });
await check("resume redirect", `/learn/${course.slug}`, { cookie: learner, expect: 307 });
await check("lesson player (text)", `/learn/${course.slug}/${lesson0.id}`, { cookie: learner, contains: ["Welcome!", "Completed", "Mark incomplete", "Next:", "Discussion", "Post comment"] });
await check("lesson player (video embed)", `/learn/${course.slug}/${videoLesson.id}`, { cookie: learner, contains: ["youtube-nocookie.com/embed/aqz-KE-bpKQ", "Mark complete"] });
await check("course landing (enrolled)", `/courses/${course.slug}`, { cookie: learner, contains: ["Your progress", "14%"] });
await check("done page", `/learn/${course.slug}/done`, { cookie: learner, contains: ["Almost there"] });

// Instructor
await check("author dashboard", "/author", { cookie: instructor, contains: ["Your courses", "Introduction to Online Teaching", "Published"] });
await check("course editor", `/author/${course.id}`, { cookie: instructor, contains: ["Outline", "Add lesson", "Add module", "Unpublish", "Danger zone"] });
await check("lesson editor", `/author/${course.id}/lessons/${videoLesson.id}`, { cookie: instructor, contains: ["Save lesson", "youtube.com/watch", "Move to module"] });
await check("learners", `/author/${course.id}/learners`, { cookie: instructor, contains: ["Lee Learner", "1/7", "Add cohort", "Enroll learners by email"] });
await check("new course", "/author/new", { cookie: instructor, contains: ["Create a course"] });
await check("author preview", `/learn/${course.slug}/${lesson0.id}`, { cookie: instructor, contains: ["Author preview"] });

// Admin
await check("admin users", "/admin/users", { cookie: admin, contains: ["Ada Admin", "Ian Instructor", "Lee Learner", "(you)"] });
await check("admin sees all courses", "/author", { cookie: admin, contains: ["by Ian Instructor"] });

// Organizations (ADMIN-6, AUTHOR-12)
{
  const anon = await check("catalog hides org course (anon)", "/", { contains: ["Introduction to Online Teaching"] });
  if (anon.text.includes("Acme Onboarding")) { failures++; console.log("FAIL anon catalog leaks org course"); }
  const pub = await check("catalog hides org course (public learner)", "/", { cookie: learner });
  if (pub.text.includes("Acme Onboarding")) { failures++; console.log("FAIL public learner sees org course"); }
  await check("catalog shows org course to member", "/", { cookie: orgStaff, contains: ["Acme Onboarding", "Acme Corp only"] });
  await check("org landing 404 for outsider", "/courses/acme-onboarding", { cookie: learner, expect: 404 });
  await check("org landing 404 for anon", "/courses/acme-onboarding", { expect: 404 });
  await check("org landing ok for member", "/courses/acme-onboarding", { cookie: orgStaff, contains: ["Enroll now", "Acme Corp only"] });
  await check("org console for org admin", "/org", { cookie: orgAdmin, contains: ["Acme Corp", "Members", "Add members by email", "Acme Onboarding"] });
  await check("org console denied for staff", "/org", { cookie: orgStaff, expect: 307 });
  await check("org admin edits org course", `/author/${acme.id}`, { cookie: orgAdmin, contains: ["Co-authors", "private to Acme Corp"] });
  await check("outside instructor cannot edit org course", `/author/${acme.id}`, { cookie: instructor, expect: 404 });
  await check("admin orgs list", "/admin/orgs", { cookie: admin, contains: ["Acme Corp", "New organization"] });
  await check("admin org detail", `/admin/orgs/${(await db.organization.findUnique({ where: { slug: "acme" } })).id}`, { cookie: admin, contains: ["Olivia OrgAdmin", "Delete organization"] });
  await check("admin users has org column", "/admin/users", { cookie: admin, contains: ["No organization", "Org admin"] });
  await check("author sees co-author panel", `/author/${course.id}`, { cookie: instructor, contains: ["Co-authors", "public"] });
}

// Interop (v0.9): API keys, REST API, webhooks, versions, SCORM
{
  const instructorUser = await db.user.findUnique({ where: { email: "instructor@example.com" } });
  const plaintext = "elk_" + randomBytes(30).toString("base64url");
  await db.apiKey.create({ data: { userId: instructorUser.id, name: "smoke", prefix: plaintext.slice(0, 12), keyHash: createHash("sha256").update(plaintext).digest("hex") } });
  const bearer = { authorization: "Bearer " + plaintext };
  await check("api: unauthenticated", "/api/v1/me", { expect: 401, contains: ["Unauthorized"] });
  await check("api: bad key", "/api/v1/me", { expect: 401, headers: { authorization: "Bearer elk_nope" } });
  await check("api: me", "/api/v1/me", { headers: bearer, contains: ["instructor@example.com", "INSTRUCTOR"] });
  await check("api: openapi", "/api/v1/openapi.json", { contains: ["openapi", "/courses/{courseId}/xapi"] });
  const list = await check("api: courses (public only)", "/api/v1/courses", { headers: bearer, contains: ["intro-to-online-teaching"] });
  if (list.text.includes("acme-onboarding")) { failures++; console.log("FAIL api leaks org course"); }
  await check("api: courses mine includes drafts", "/api/v1/courses?mine=1", { headers: bearer, contains: ["intro-to-online-teaching"] });
  await check("api: course detail", `/api/v1/courses/${course.id}`, { headers: bearer, contains: ["modules", "Getting started", "Knowledge check"] });
  await check("api: org course 404 for outsider", `/api/v1/courses/${acme.id}`, { headers: bearer, expect: 404 });
  await check("api: enrollments", `/api/v1/courses/${course.id}/enrollments`, { headers: bearer, contains: ["learner@example.com", "progressPct"] });
  await check("api: xapi statements", `/api/v1/courses/${course.id}/xapi`, { headers: bearer, contains: ["adlnet.gov/expapi/verbs/registered", "mailto:learner@example.com"] });

  // Webhook: receive a signed enrollment.created when enrolling via the API.
  const received = [];
  const server = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { received.push({ headers: req.headers, body: b }); res.writeHead(200); res.end("ok"); }); });
  await new Promise((r) => server.listen(3555, r));
  const secret = "whsec_smoke";
  const hook = await db.webhook.create({ data: { userId: instructorUser.id, url: "http://localhost:3555/hook", secret, events: "*" } });
  const newbie = await db.user.upsert({ where: { email: "smoke-newbie@example.com" }, update: {}, create: { email: "smoke-newbie@example.com", name: "Smoke Newbie", passwordHash: "x" } });
  await db.enrollment.deleteMany({ where: { userId: newbie.id, courseId: course.id } });
  await check("api: enroll by email", `/api/v1/courses/${course.id}/enrollments`, { method: "POST", headers: { ...bearer, "content-type": "application/json" }, body: JSON.stringify({ email: newbie.email }), expect: 201, contains: ["\"created\":true"] });
  await check("api: enroll again is idempotent", `/api/v1/courses/${course.id}/enrollments`, { method: "POST", headers: { ...bearer, "content-type": "application/json" }, body: JSON.stringify({ email: newbie.email }), expect: 200, contains: ["\"created\":false"] });
  await new Promise((r) => setTimeout(r, 1500));
  const hit = received.find((r) => r.headers["x-elearner-event"] === "enrollment.created");
  const sigOk = hit && hit.headers["x-elearner-signature"] === "sha256=" + createHmac("sha256", secret).update(hit.body).digest("hex");
  console.log(`${hit && sigOk ? "PASS" : "FAIL"} webhook delivered with valid signature${hit ? "" : " (no delivery received)"}`);
  if (!(hit && sigOk)) failures++;
  const delivery = await db.webhookDelivery.findFirst({ where: { webhookId: hook.id } });
  console.log(`${delivery && delivery.status === 200 ? "PASS" : "FAIL"} webhook delivery logged (status ${delivery?.status})`);
  if (!(delivery && delivery.status === 200)) failures++;
  server.close();
  await db.webhook.delete({ where: { id: hook.id } });
  await db.user.delete({ where: { id: newbie.id } });

  await check("settings page", "/settings", { cookie: instructor, contains: ["API keys", "Webhooks", "smoke"] });
  await check("versions page", `/author/${course.id}/versions`, { cookie: instructor, contains: ["Save snapshot"] });
  const scorm = await fetch(BASE + `/author/${course.id}/scorm`, { headers: { cookie: instructor } });
  const zipOk = scorm.status === 200 && (scorm.headers.get("content-type") || "").includes("zip") && (await scorm.arrayBuffer()).byteLength > 1000;
  console.log(`${zipOk ? "PASS" : "FAIL"} scorm export [${scorm.status} ${scorm.headers.get("content-type")}]`);
  if (!zipOk) failures++;
  await check("scorm denied for learner", `/author/${course.id}/scorm`, { cookie: learner, expect: 403 });
  await db.apiKey.deleteMany({ where: { userId: instructorUser.id, name: "smoke" } });
}

// Commerce (v1.0)
await check("pricing page", `/author/${course.id}/pricing`, { cookie: instructor, contains: ["Pricing &amp; sales", "New coupon", "test mode"] });
await check("pricing denied for learner", `/author/${course.id}/pricing`, { cookie: learner, expect: 307 });
await check("stripe webhook 404 when unconfigured", "/api/stripe/webhook", { method: "POST", expect: 404 });
await check("mock checkout 404 for unknown purchase", "/checkout/mock/nope", { cookie: learner, expect: 404 });

// Discovery (v1.1: LEARN-14/15/16)
{
  await check("catalog search", "/?q=assessment", { contains: ["Assessment Design Basics", "matching"] });
  const miss = await check("catalog search excludes non-matches", "/?q=assessment");
  if (miss.text.includes("Introduction to Online Teaching")) { failures++; console.log("FAIL search returned non-matching course"); }
  await check("catalog tag filter", "/?tag=assessment", { contains: ["Assessment Design Basics", "tagged #assessment"] });
  await check("catalog level filter", "/?level=BEGINNER", { contains: ["Introduction to Online Teaching"] });
  await check("catalog shows rating + featured", "/", { contains: ["4.5 (2)", "Featured", "#teaching", "Learning paths", "Become an Online Instructor"] });
  await check("catalog no match", "/?q=zzzznotacourse", { contains: ["No courses match"] });
  await check("paths list", "/paths", { contains: ["Become an Online Instructor", "2 courses"] });
  await check("path detail (anon)", "/paths/online-instructor", { contains: ["Sign in to start", "Introduction to Online Teaching", "Assessment Design Basics"] });
  await check("path detail (learner)", "/paths/online-instructor", { cookie: learner, contains: ["Start path"] });
  await check("course landing reviews", `/courses/${course.slug}`, { cookie: learner, contains: ["Reviews", "Clear, practical", "Your review", "Update review", "#course-design"] });
  await check("author paths", "/author/paths", { cookie: instructor, contains: ["Become an Online Instructor", "New path"] });
  await check("author paths denied for learner", "/author/paths", { cookie: learner, expect: 307 });
  const path = await db.learningPath.findUnique({ where: { slug: "online-instructor" } });
  await check("author path editor", `/author/paths/${path.id}`, { cookie: instructor, contains: ["Courses in order", "Add a course", "Unpublish", "Delete path"] });
  await check("course form has tags + level", `/author/${course.id}`, { cookie: instructor, contains: ["Tags", "Level"] });
  await check("api: search", "/api/v1/courses?q=assessment&sort=rating", { cookie: learner, contains: ["assessment-design-basics", "\"sort\":\"rating\""] });
  await check("api: paths", "/api/v1/paths", { cookie: learner, contains: ["online-instructor", "\"courseCount\":2"] });
  await check("api: courses have rating + tags", "/api/v1/courses?tag=teaching", { cookie: learner, contains: ["\"tags\":[\"teaching\"", "\"rating\":{\"avg\":4.5,\"count\":2}"] });
}

// Assess II (v1.2: QUIZ-7/8/9)
{
  await check("grading queue (instructor)", `/author/${course.id}/grading`, { cookie: instructor, contains: ["Grading queue", "Nothing to grade"] });
  await check("grading queue denied for learner", `/author/${course.id}/grading`, { cookie: learner, expect: 307 });
  await check("course editor has Grading button", `/author/${course.id}`, { cookie: instructor, contains: ["Grading"] });
  const timed = await db.lesson.findFirst({ where: { title: "Check your understanding" }, include: { module: { include: { course: true } } } });
  await check("timed quiz author preview", `/learn/${timed.module.course.slug}/${timed.id}`, { cookie: instructor, contains: ["10 min time limit", "3 question(s)"] });
  await check("timed quiz editor shows essay + limit", `/author/${timed.module.course.id}/lessons/${timed.id}`, { cookie: instructor, contains: ["Essay (graded by instructor)", "Rubric", "Time limit", "Questions per attempt"] });
}

// Engage (v1.3: LEARN-17..20)
{
  await check("profile", "/me", { cookie: learner, contains: ["Lee Learner", "day streak", "First step", "Earned", "Last 14 days"] });
  await check("profile redirects anon", "/me", { expect: 307 });
  await check("notifications", "/notifications", { cookie: learner, contains: ["Welcome to the September cohort", "Mark all read"] });
  await check("nav shows unread badge", "/learn", { cookie: learner, contains: ["unread notification", "day streak", "points"] });
  await check("leaderboard (cohort)", `/learn/${course.slug}/leaderboard`, { cookie: learner, contains: ["Leaderboard", "September 2026", "Lee Learner", "(you)"] });
  await check("leaderboard (author, whole course)", `/learn/${course.slug}/leaderboard`, { cookie: instructor, contains: ["Whole course", "September 2026"] });
  await check("landing shows announcements to enrolled", `/courses/${course.slug}`, { cookie: learner, contains: ["Announcements", "Welcome to the September cohort", "Leaderboard"] });
  const anonLanding = await check("landing hides announcements from anon", `/courses/${course.slug}`);
  if (anonLanding.text.includes("Welcome to the September cohort")) { failures++; console.log("FAIL announcements leaked to anon"); }
  await check("announcements editor", `/author/${course.id}/announcements`, { cookie: instructor, contains: ["New announcement", "Welcome to the September cohort", "Also send by email"] });
  await check("announcements denied for learner", `/author/${course.id}/announcements`, { cookie: learner, expect: 307 });
}

// CSV export (ADMIN-5)
await check("csv export (instructor)", `/author/${course.id}/learners/export`, { cookie: instructor, contains: ["name,email,enrolled_at", "learner@example.com", "quiz: Knowledge check"] });
await check("csv export denied (learner)", `/author/${course.id}/learners/export`, { cookie: learner, expect: 403 });
await check("certificate redirects when incomplete", `/learn/${course.slug}/certificate`, { cookie: learner, expect: 307 });

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
