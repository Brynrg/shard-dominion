import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/liveness',
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    url: 'http://localhost:4173',
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
});
