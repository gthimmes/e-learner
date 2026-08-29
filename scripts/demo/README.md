# Demo walkthrough recording

`walkthrough.spec.ts` is a Playwright script that drives the seeded app like a person would
(eased cursor, wheel scrolling, captions) and records a ~2½-minute product walkthrough. It
follows the `ui-demo-recording` harness conventions; the recording itself stays out of git.

## Record

```bash
# 1. Fresh demo data, no leftovers from e2e runs
npm run db:seed
node scripts/cleanup-test-data.mjs

# 2. Production build so there are no dev-compile stalls mid-take
npm run build
SESSION_SECRET=demo-only-secret npm start -- --port 3100

# 3. Record (from a scratch directory with @playwright/test installed, or from the repo root)
TARGET_URL=http://localhost:3100 PAUSE_SCALE=1.0 \
  npx playwright test --config scripts/demo/playwright.config.ts
```

The raw `video.webm` lands under `scripts/demo/output/` (git-ignored). Post-process with the
skill's `postprocess.sh` (H.264 MP4, per-second frames, contact sheet), then **look at at least 8
frames** before sharing — captions must describe only what is on screen.

Tuning: `PAUSE_SCALE` scales the dwell times (1.0 ≈ 140 s); `VIEWPORT_WIDTH/HEIGHT`,
`DEVICE_SCALE_FACTOR`, `OUTPUT_DIR` are read by `playwright.config.ts`.

The take creates one learner (`dana.demo+<timestamp>@example.com`), a quiz attempt and a review;
`node scripts/cleanup-test-data.mjs` removes them again.
