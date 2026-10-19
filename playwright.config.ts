import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/e2e', fullyParallel: false, workers: 1, retries: 0,
  timeout: 90000,
  expect: { timeout: 30000 },
  use: { baseURL: process.env.PUBLIC_URL ?? 'http://localhost:19000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
});
