import { defineConfig } from 'vite';

// base:'./' keeps the build mount-location independent (deploy contract).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
});
