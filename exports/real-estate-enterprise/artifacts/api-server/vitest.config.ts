import { defineConfig } from "vitest/config";

// Two complementary test styles share this config:
//  - DB-backed integration tests in `src/**/*.test.ts` drive the app in-process
//    (supertest) against the development database, seeding/tearing down their
//    own uniquely-tagged fixtures.
//  - End-to-end tests in `test/**/*.test.ts` spin up the real built server via
//    `global-setup` and exercise it over HTTP inside the isolated demo schema.
export default defineConfig({
  resolve: {
    // Match the repo's TypeScript `customConditions`, so `@workspace/*` packages
    // resolve to their TS source the same way the build and typecheck do.
    conditions: ["workspace"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Both suites share a single connection pool / live server + demo schema, so
    // run files serially and give the seed-backed setup room to breathe.
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
