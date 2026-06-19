import { defineConfig } from "vitest/config";

// Tests run against the real (development) PostgreSQL database using the same
// connection as the server. Each suite seeds uniquely-tagged fixtures and
// tears them down, so it is safe to run alongside existing data.
export default defineConfig({
  resolve: {
    // Match the repo's TypeScript `customConditions`, so `@workspace/*` packages
    // resolve to their TS source the same way the build and typecheck do.
    conditions: ["workspace"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // DB-backed integration tests share a single connection pool; keep them in
    // one process to avoid exhausting connections and to make teardown reliable.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
