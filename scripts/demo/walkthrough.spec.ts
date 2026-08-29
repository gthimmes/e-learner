/**
 * e-learner product walkthrough — recorded with the ui-demo-recording harness.
 *
 * Shot plan (each beat's caption describes only what is on screen):
 *  1. Catalog (anonymous)            — entry point; search, tags, ratings, paths strip
 *  2. Search + tag filter            — keyword narrows results; tag chip filters
 *  3. Sign up                        — real registration through the UI
 *  4. Learning path → start          — path detail, Start path lands on first course
 *  5. Course landing → enroll        — rating/reviews visible, Enroll now
 *  6. Lesson player                  — reading lesson, mark complete, video lesson
 *  7. Quiz                           — answer four question types, submit, 100 % pass
 *  8. Review                         — 5-star review posted from the landing page
 *  9. Instructor: dashboard/editor   — sign out, sign in as instructor, editor, learners + quiz analytics
 * 10. Instructor: path editor        — the path from beat 4, authored here
 * 11. Closing cap                    — "In production:" for what the take does not show
 */

import { test, expect, Page, Locator } from '@playwright/test';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3100';
const PAUSE_SCALE = Number(process.env.PAUSE_SCALE || '1');
const STAMP = process.env.DEMO_STAMP || String(Date.now());
const DEMO_EMAIL = `dana.demo+${STAMP}@example.com`;

const ms = (n: number) => Math.round(n * PAUSE_SCALE);

// ============================================================================
// Interaction Standard helpers (from the skill template — keep intact)
// ============================================================================

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function easedMouseMove(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  opts: { steps?: number; durationMs?: number } = {},
): Promise<void> {
  const steps = opts.steps ?? 24;
  const durationMs = opts.durationMs ?? 600;
  for (let i = 1; i <= steps; i++) {
    const t = easeInOutCubic(i / steps);
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    await page.mouse.move(x, y, { steps: 1 });
    await paintCursor(page, x, y);
    await page.waitForTimeout(Math.max(8, Math.round(durationMs / steps)));
  }
}

async function paintCursor(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ x, y }) => {
      const id = '__demo_cursor';
      let el = document.getElementById(id) as HTMLDivElement | null;
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        Object.assign(el.style, {
          position: 'fixed',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: 'rgba(20, 30, 60, 0.95)',
          boxShadow: '0 0 0 3px rgba(255,255,255,0.85), 0 6px 14px rgba(0,0,0,0.30)',
          pointerEvents: 'none',
          zIndex: '2147483646',
          transform: 'translate(-50%, -50%)',
          transition: 'transform 80ms linear',
        } as Partial<CSSStyleDeclaration>);
        document.body.appendChild(el);
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    { x, y },
  );
}

async function smoothWheel(
  page: Page,
  totalDeltaY: number,
  opts: { stepDelta?: number; stepIntervalMs?: number; settleMs?: number } = {},
): Promise<void> {
  const stepDelta = opts.stepDelta ?? 80;
  const stepIntervalMs = opts.stepIntervalMs ?? 60;
  const settleMs = opts.settleMs ?? 450;
  const direction = Math.sign(totalDeltaY);
  let remaining = Math.abs(totalDeltaY);
  while (remaining > 0) {
    const step = Math.min(stepDelta, remaining);
    await page.mouse.wheel(0, direction * step);
    await page.waitForTimeout(stepIntervalMs);
    remaining -= step;
  }
  await page.waitForTimeout(ms(settleMs));
}

async function lastCursor(page: Page): Promise<{ x: number; y: number }> {
  const last = await page.evaluate(() => {
    const el = document.getElementById('__demo_cursor');
    if (!el) return null;
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  });
  return last ?? { x: 200, y: 200 };
}

/** Eased move to a Locator's centre (scrolls it into view first if needed). */
async function moveTo(page: Page, target: Locator, opts: { durationMs?: number } = {}): Promise<void> {
  await target.first().scrollIntoViewIfNeeded();
  const box = await target.first().boundingBox();
  if (!box) throw new Error('No bounding box for locator');
  const start = await lastCursor(page);
  await easedMouseMove(page, start.x, start.y, box.x + box.width / 2, box.y + box.height / 2, { durationMs: opts.durationMs ?? 650 });
}

/** Move to a locator, pause briefly, click. */
async function click(page: Page, target: Locator, opts: { durationMs?: number; pauseMs?: number } = {}): Promise<void> {
  await moveTo(page, target, opts);
  await page.waitForTimeout(ms(opts.pauseMs ?? 350));
  await target.first().click();
}

/** Move to an input, click it, and type like a person. */
async function type(page: Page, target: Locator, text: string, delay = 45): Promise<void> {
  await click(page, target, { pauseMs: 150 });
  await target.first().pressSequentially(text, { delay });
}

// ============================================================================
// Caption overlay
// ============================================================================

async function caption(page: Page, title: string, body = ''): Promise<void> {
  await page.evaluate(
    ({ title, body }: { title: string; body: string }) => {
      const id = '__demo_recording_caption';
      let el = document.getElementById(id) as HTMLDivElement | null;
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        Object.assign(el.style, {
          position: 'fixed',
          left: '28px',
          bottom: '28px',
          zIndex: '2147483647',
          maxWidth: '760px',
          padding: '16px 20px',
          borderRadius: '10px',
          background: 'rgba(8, 14, 24, 0.93)',
          color: '#ffffff',
          boxShadow: '0 12px 32px rgba(0,0,0,0.30)',
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          pointerEvents: 'none',
        } as Partial<CSSStyleDeclaration>);
        document.body.appendChild(el);
      }
      while (el.firstChild) el.removeChild(el.firstChild);
      const h = document.createElement('div');
      h.textContent = title;
      Object.assign(h.style, { fontSize: '22px', fontWeight: '750', letterSpacing: '0', lineHeight: '1.18' });
      el.appendChild(h);
      if (body) {
        const p = document.createElement('div');
        p.textContent = body;
        Object.assign(p.style, { marginTop: '6px', fontSize: '15px', lineHeight: '1.4', color: 'rgba(255,255,255,0.90)' });
        el.appendChild(p);
      }
    },
    { title, body },
  );
}

/** Remove the overlay so a caption never describes a page that is no longer on screen. */
async function clearCaption(page: Page): Promise<void> {
  await page.evaluate(() => document.getElementById('__demo_recording_caption')?.remove());
}

// ============================================================================
// Clutter watchdog (e-learner embeds no third-party widgets; kept for parity)
// ============================================================================

const CLUTTER_RE = /userback|feedback-tab|feedback-button|feedback-launcher|intercom|chat-widget|support-chat|forethought|pendo|drift|appcues|hotjar|fullstory/i;
const CLUTTER_TAGS = ['us-button'];

const CLUTTER_INIT = `
(() => {
  const SIG = ${CLUTTER_RE.toString()};
  const TAGS = new Set(${JSON.stringify(CLUTTER_TAGS)});
  const KEEP = new Set(['__demo_recording_caption', '__demo_cursor']);
  const hide = (el) => {
    if (!el || el.nodeType !== 1) return;
    if (KEEP.has(el.id)) return;
    const tag = el.tagName.toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '') || '';
    const id = el.id || '';
    const titleAttr = el.getAttribute && el.getAttribute('title') || '';
    if (TAGS.has(tag)) { el.style.setProperty('display', 'none', 'important'); return; }
    if (tag === 'iframe' && (id === 'launcher' || /chat|forethought|intercom|drift/i.test(titleAttr))) { el.style.setProperty('display', 'none', 'important'); return; }
    if (SIG.test(\`\${tag} \${cls} \${id} \${titleAttr}\`)) el.style.setProperty('display', 'none', 'important');
  };
  const sweep = (root) => { root.querySelectorAll && root.querySelectorAll('*').forEach(hide); };
  const run = () => {
    sweep(document);
    new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { hide(n); n.querySelectorAll && sweep(n); } });
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
})();
`;

// ============================================================================
// Walkthrough
// ============================================================================

test('e-learner walkthrough', async ({ page, context }) => {
  const failedResponses: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.url()}`);
  });
  page.on('pageerror', (err) => console.log('PAGE_ERROR', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE_ERROR', msg.text());
  });
  await context.addInitScript(CLUTTER_INIT);
  test.setTimeout(420_000);

  const nav = page.locator('header nav').first();
  const settled = async () => {
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  };

  // ---------------- BEAT 1 — Catalog (anonymous) ----------------
  await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Course catalog' }).waitFor();
  await settled();
  await paintCursor(page, 640, 300);
  await caption(page, 'e-learner', 'Create online courses and take them anywhere. Everything in this take is the live app, seeded with demo data.');
  await page.waitForTimeout(ms(3800));

  // Drift across the path strip and course cards.
  await moveTo(page, page.getByRole('link', { name: /Become an Online Instructor/ }), { durationMs: 900 });
  await caption(page, 'Discover', 'The catalog opens with learning paths, then courses with ratings, tags, levels and prices.');
  await page.waitForTimeout(ms(1800));
  await moveTo(page, page.getByRole('link', { name: /Introduction to Online Teaching/ }), { durationMs: 900 });
  await page.waitForTimeout(ms(1200));
  await moveTo(page, page.getByRole('link', { name: /Assessment Design Basics/ }), { durationMs: 700 });
  await page.waitForTimeout(ms(1200));

  // ---------------- BEAT 2 — Search + tag filter ----------------
  await caption(page, 'Search and filter', 'Keyword search over titles, summaries and tags — plus tag chips, level and sort.');
  await type(page, page.getByLabel('Search courses'), 'assessment');
  await click(page, page.getByRole('button', { name: 'Search' }));
  await page.waitForURL(/q=assessment/);
  await settled();
  await page.getByRole('link', { name: /Assessment Design Basics/ }).waitFor();
  await page.waitForTimeout(ms(2200));
  await click(page, page.getByRole('link', { name: 'Clear' }));
  await page.waitForURL((u) => !u.search.includes('q='));
  await settled();
  await click(page, page.getByRole('link', { name: /^#teaching/ }));
  await page.waitForURL(/tag=teaching/);
  await settled();
  await caption(page, 'Tag filter', 'One click on a tag narrows the catalog to courses tagged #teaching.');
  await page.waitForTimeout(ms(2400));

  // ---------------- BEAT 3 — Sign up ----------------
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: 'Get started' }).first());
  await page.waitForURL(/\/register/);
  await page.getByRole('heading', { name: /Create your account/ }).waitFor();
  await caption(page, 'Sign up', 'A learner creates an account with an email and password. SSO via OpenID Connect is also supported.');
  await type(page, page.getByLabel('Name'), 'Dana Demo');
  await type(page, page.getByLabel('Email'), DEMO_EMAIL, 30);
  await type(page, page.getByLabel('Password'), 'password123', 60);
  await click(page, page.getByRole('button', { name: 'Create account' }));
  await page.waitForURL(/\/learn/);
  await page.getByRole('heading', { name: 'My Learning' }).waitFor();
  await settled();
  await caption(page, 'My Learning', 'Empty for now — enrolled courses, progress and due dates will show up here.');
  await page.waitForTimeout(ms(2200));

  // ---------------- BEAT 4 — Learning path ----------------
  await clearCaption(page);
  await click(page, nav.getByRole('link', { name: 'Paths' }));
  await page.waitForURL(/\/paths$/);
  await settled();
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: /Become an Online Instructor/ }));
  await page.waitForURL(/\/paths\/online-instructor/);
  await page.getByRole('heading', { name: 'Become an Online Instructor' }).waitFor();
  await settled();
  await caption(page, 'Learning paths', 'An ordered bundle of courses. Progress is tracked per course and across the whole path.');
  await moveTo(page, page.getByRole('heading', { name: 'Courses in this path' }), { durationMs: 900 });
  await page.waitForTimeout(ms(2600));
  await clearCaption(page);
  await click(page, page.getByRole('button', { name: 'Start path' }));
  await page.waitForURL(/\/courses\/intro-to-online-teaching/);
  await page.getByRole('heading', { name: 'Introduction to Online Teaching' }).waitFor();
  await settled();

  // ---------------- BEAT 5 — Course landing → enroll ----------------
  await caption(page, 'Course landing', 'Starting the path opens its first course: outline, duration, level, tags and a 4.5-star rating from two reviews.');
  await moveTo(page, page.locator('a[href="#reviews"]'), { durationMs: 900 });
  await page.waitForTimeout(ms(1600));
  await moveTo(page, page.getByRole('heading', { name: 'Course outline' }), { durationMs: 900 });
  await page.waitForTimeout(ms(1800));
  await clearCaption(page);
  await click(page, page.getByRole('button', { name: 'Enroll now' }));
  await page.waitForURL(/\/learn\/intro-to-online-teaching\//);
  await page.getByRole('navigation', { name: 'Course outline' }).waitFor();
  await settled();

  // ---------------- BEAT 6 — Lesson player ----------------
  await caption(page, 'Course player', 'Outline on the left, lesson content on the right. Lessons are Markdown, video, audio, images, downloads or quizzes.');
  await moveTo(page, page.getByRole('heading', { name: 'Welcome!' }), { durationMs: 900 });
  await page.waitForTimeout(ms(2200));
  await smoothWheel(page, 420, { stepDelta: 70, stepIntervalMs: 55 });
  await page.waitForTimeout(ms(800));
  await clearCaption(page);
  await click(page, page.getByRole('button', { name: /Mark complete & continue/ }));
  await page.waitForURL((u) => /\/learn\/intro-to-online-teaching\/[a-z0-9]+$/.test(u.pathname) && !u.pathname.includes('done'));
  await page.locator('iframe[src*="youtube"]').waitFor();
  await settled();
  await caption(page, 'Video lesson', 'Marking a lesson complete advances to the next one. Video lessons embed YouTube/Vimeo or an uploaded file; playback position is remembered.');
  await moveTo(page, page.locator('iframe[src*="youtube"]'), { durationMs: 900 });
  await page.waitForTimeout(ms(3000));

  // ---------------- BEAT 7 — Quiz ----------------
  await clearCaption(page);
  await click(page, page.getByRole('navigation', { name: 'Course outline' }).getByRole('link', { name: /Knowledge check/ }));
  await page.getByRole('button', { name: 'Submit answers' }).waitFor();
  await settled();
  await caption(page, 'Quiz', 'Four question types — multiple choice, multi-select, true/false and short answer — auto-graded against a pass mark.');
  await page.waitForTimeout(ms(1200));
  await click(page, page.getByLabel('Under 10 minutes'));
  await click(page, page.getByLabel('Video', { exact: true }));
  await click(page, page.getByLabel('Audio', { exact: true }));
  await click(page, page.getByLabel('Images', { exact: true }));
  await click(page, page.getByLabel('False', { exact: true }));
  await type(page, page.getByPlaceholder('Your answer'), 'Markdown');
  await page.waitForTimeout(ms(500));
  await clearCaption(page);
  await click(page, page.getByRole('button', { name: 'Submit answers' }));
  await page.waitForURL(/attempt=/);
  await page.getByText('100%').first().waitFor();
  await settled();
  await caption(page, 'Passed — 100 %', 'Answers are graded instantly with explanations. Passing the quiz completes the lesson.');
  await moveTo(page, page.getByText('100%').first(), { durationMs: 900 });
  await page.waitForTimeout(ms(3200));

  // ---------------- BEAT 8 — Review ----------------
  await clearCaption(page);
  await click(page, page.locator('a[href="/courses/intro-to-online-teaching"]').first());
  await page.waitForURL(/\/courses\/intro-to-online-teaching$/);
  await page.getByRole('heading', { name: 'Reviews' }).waitFor();
  await settled();
  await caption(page, 'Ratings and reviews', 'Enrolled learners rate a course once. Averages feed the catalog cards and the "Top rated" sort.');
  const reviewsTop = await page.evaluate(() => (document.querySelector('#reviews')?.getBoundingClientRect().top ?? 0) - 110);
  await smoothWheel(page, Math.max(0, reviewsTop), { stepDelta: 110, stepIntervalMs: 45 });
  await click(page, page.getByRole('radio', { name: '5 stars' }));
  await type(page, page.getByLabel(/What did you think/), 'Short, clear and hands-on. The quiz made it stick.', 28);
  await click(page, page.getByRole('button', { name: 'Post review' }));
  await page.getByText('Thanks — your review is live.').waitFor();
  await settled();
  await page.waitForTimeout(ms(2600));

  // ---------------- BEAT 9 — Instructor ----------------
  await clearCaption(page);
  await click(page, page.getByRole('button', { name: 'Sign out' }));
  await page.waitForURL((u) => u.pathname === '/');
  await settled();
  await click(page, page.getByRole('link', { name: 'Sign in' }).first());
  await page.waitForURL(/\/login/);
  await caption(page, 'Now as the instructor', 'Signing in as the course author to see the other side of the product.');
  await type(page, page.getByLabel('Email'), 'instructor@example.com', 25);
  await type(page, page.getByLabel('Password'), 'password123', 45);
  await clearCaption(page);
  await click(page, page.getByRole('button', { name: 'Sign in' }));
  await page.waitForURL(/\/learn/);
  await settled();
  await clearCaption(page);
  await click(page, nav.getByRole('link', { name: 'Author' }));
  await page.waitForURL(/\/author$/);
  await page.getByRole('heading', { name: 'Your courses' }).waitFor();
  await settled();
  await caption(page, 'Author dashboard', 'Every course with status, content size, enrollments and completion rate.');
  await moveTo(page, page.getByRole('link', { name: 'Introduction to Online Teaching' }), { durationMs: 900 });
  await page.waitForTimeout(ms(2200));
  await clearCaption(page);
  await page.getByRole('link', { name: 'Introduction to Online Teaching' }).first().click();
  await page.waitForURL(/\/author\/[a-z0-9]+$/);
  await page.getByRole('heading', { name: 'Outline' }).waitFor();
  await settled();
  await caption(page, 'Course editor', 'Modules and lessons with reordering, co-authors, publish/unpublish, versions, pricing and SCORM export.');
  await moveTo(page, page.getByRole('heading', { name: 'Outline' }), { durationMs: 900 });
  await page.waitForTimeout(ms(1600));
  await smoothWheel(page, 260, { stepDelta: 65, stepIntervalMs: 55 });
  await page.waitForTimeout(ms(1400));
  await smoothWheel(page, -260, { stepDelta: 65, stepIntervalMs: 45 });
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: 'Learners', exact: true }));
  await page.waitForURL(/\/learners$/);
  await page.getByText('Dana Demo').first().waitFor();
  await settled();
  await caption(page, 'Learners', 'Dana just appeared with her progress. Cohorts with due dates, direct enrollment and CSV export live here.');
  await moveTo(page, page.getByText('Dana Demo').first(), { durationMs: 900 });
  await page.waitForTimeout(ms(2600));

  // Quiz analytics live on the quiz lesson's editor page.
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: /Back to editor/ }));
  await page.waitForURL(/\/author\/[a-z0-9]+$/);
  await page.getByRole('heading', { name: 'Outline' }).waitFor();
  await settled();
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: 'Knowledge check' }));
  await page.waitForURL(/\/lessons\//);
  await page.getByRole('heading', { name: 'Quiz results' }).waitFor();
  await settled();
  const statsTop = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('h2')).find((h) => /Quiz results/.test(h.textContent || ''));
    return el ? el.getBoundingClientRect().top - 140 : 0;
  });
  await smoothWheel(page, Math.max(0, statsTop), { stepDelta: 110, stepIntervalMs: 45 });
  await caption(page, 'Quiz analytics', 'Per-quiz attempts, pass rate, average score and the hardest questions — Dana’s 100 % is already counted.');
  await moveTo(page, page.getByText('Pass rate'), { durationMs: 900 });
  await page.waitForTimeout(ms(3000));

  // ---------------- BEAT 10 — Path editor ----------------
  await clearCaption(page);
  await click(page, nav.getByRole('link', { name: 'Author' }));
  await page.waitForURL(/\/author$/);
  await settled();
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: 'Learning paths' }));
  await page.waitForURL(/\/author\/paths$/);
  await settled();
  await clearCaption(page);
  await click(page, page.getByRole('link', { name: 'Become an Online Instructor' }));
  await page.waitForURL(/\/author\/paths\/[a-z0-9]+$/);
  await page.getByRole('heading', { name: 'Courses in order' }).waitFor();
  await settled();
  await caption(page, 'Path editor', 'The path Dana followed is authored here: pick courses, order them, publish.');
  await moveTo(page, page.getByRole('heading', { name: 'Courses in order' }), { durationMs: 900 });
  await page.waitForTimeout(ms(2800));

  // ---------------- BEAT 11 — Closing cap ----------------
  await caption(
    page,
    'e-learner v1.1',
    'In production: the same app also runs Stripe checkout and refunds, SSO, cohort reminders, signed webhooks, xAPI/SCORM export and a REST API — not shown in this take.',
  );
  await page.waitForTimeout(ms(5000));

  const finalUrl = page.url();
  expect(finalUrl).toBeTruthy();
  console.log(`FINAL_URL=${finalUrl}`);
  console.log(`DEMO_EMAIL=${DEMO_EMAIL}`);
  console.log(`FAILED_RESPONSES=${JSON.stringify(failedResponses)}`);
});
