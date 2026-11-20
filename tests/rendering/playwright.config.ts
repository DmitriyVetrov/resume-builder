import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  retries: 0,
  reporter: 'list',
  outputDir: 'out/test-results',
  timeout: 180_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4179' },
  webServer: { command: 'node serve.mjs', url: 'http://127.0.0.1:4179/health', reuseExistingServer: false, timeout: 10_000 },
  projects: [
    // LCD text paints coloured fringes the PDF raster cannot have, and G2 compares per channel.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-lcd-text'] } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
