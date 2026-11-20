import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['smoke.spec.ts', 'shell.spec.ts', 'account.spec.ts', 'library.spec.ts', 'editor.spec.ts', 'rich-text.spec.ts', 'design.spec.ts', 'preview.spec.ts', 'export.spec.ts', 'theme.spec.ts', 'data-lifecycle.spec.ts', 'template-t4.spec.ts', 'import.spec.ts'],
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  outputDir: 'test-results',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run preview --prefix ../../frontend -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
