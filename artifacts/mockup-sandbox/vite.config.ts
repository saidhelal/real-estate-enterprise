import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

/**
 * A port is needed to *serve*, not to build.
 *
 * This threw whenever `PORT` was absent, which meant `vite build` failed on a
 * machine that had never run this app — and because the workspace build runs
 * every package, one unserved sandbox failed the whole repository's build,
 * including the ERP. A build produces files and binds nothing, so it has no
 * business demanding a port.
 *
 * The requirement still holds for `dev` and `preview`, where the number
 * genuinely decides what gets bound. No default is invented: an unset PORT is
 * still an error there, it is simply not an error here.
 */
const serving = process.argv.some((a) => a === "dev" || a === "serve" || a === "preview");

const rawPort = process.env.PORT;

if (serving && !rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort ?? 0);

if (serving && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// The base path shapes the built asset URLs, so unlike the port it matters to
// a build as much as to a server. Defaulted to the root rather than demanded,
// because a sandbox built for inspection is served from "/" by default.
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
