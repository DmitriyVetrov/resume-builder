import { defineConfig, devices } from '@playwright/test';

// Step 7 only: real browser, real API, Mongo and Azurite behind real-stack/proxy.mjs. Not part of the fixture suite.
export default defineConfig({
  testDir: 'real-stack',
  testMatch: ['*.spec.ts'],
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results',
  use: { baseURL: process.env.RESUMISER_REAL_URL ?? 'http://localhost:4190' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
