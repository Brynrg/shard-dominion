import { defineConfig } from "vite";

// `base: "./"` is REQUIRED so built asset URLs are relative.
// speedrungames.net proxies this game under /games/<slug>/, and
// absolute paths (`/assets/foo.js`) would break under that mount.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
