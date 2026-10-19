import { defineConfig } from '@playwright/test';
import { env } from './support/env';

// The journeys build on each other (one account moves through signup, upgrade, cancellation and
// deletion), so they run in order in a single worker against one stack.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: env.appUrl, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'de-CH' },
});
