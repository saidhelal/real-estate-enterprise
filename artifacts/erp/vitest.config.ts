import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // The app builds JSX with the automatic runtime; without saying so here the
  // test transform emits `React.createElement` into files that never import
  // React, and every JSX test fails on a missing global.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // `.tsx` too, so a test can build the React element it is asserting about
    // instead of describing one. Nothing here renders — `environment: "node"`
    // stays, because these assert on element objects, not on a DOM.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
