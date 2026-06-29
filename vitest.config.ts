import { defineConfig } from 'vitest/config';

// The contract layer + sim are pure → node environment. View/liveness tests
// (jsdom / Playwright) are added at their slices; they are not in this config.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
