import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/liveness',
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173',
    // 800×640: the canvas CSS size resolves to exactly its 800×600 backing store,
    // so gates that click at fixed canvas coordinates keep CSS px == backing px.
    viewport: { width: 800, height: 640 },
  },
  webServer: {
    command: 'pnpm run build && pnpm run preview',
    url: 'http://localhost:4173',
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
});
