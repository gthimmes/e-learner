import { defineConfig, devices } from '@playwright/test';

/**
 * Default config for UI demo recordings. The runbook's Recording Standard
 * specifies 1920x1080 H.264 yuv420p faststart, but for product walkthroughs
 * destined for Drive / Notion embeds, 1280x720 with deviceScaleFactor 2
 * produces sharper text at half the file size. Override via env if needed.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'walkthrough.spec.ts',
  timeout: 240_000,
  use: {
    baseURL: process.env.TARGET_URL || 'http://localhost:3100',
    headless: true,
    viewport: {
      width: Number(process.env.VIEWPORT_WIDTH || '1280'),
      height: Number(process.env.VIEWPORT_HEIGHT || '720'),
    },
    deviceScaleFactor: Number(process.env.DEVICE_SCALE_FACTOR || '2'),
    video: {
      mode: 'on',
      size: {
        width: Number(process.env.VIEWPORT_WIDTH || '1280'),
        height: Number(process.env.VIEWPORT_HEIGHT || '720'),
      },
    },
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  reporter: [['list']],
  outputDir: process.env.OUTPUT_DIR || './output',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
