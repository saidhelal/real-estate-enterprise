---
name: Seed runner
description: Why the DB seed needs esbuild bundling instead of plain node
---
The seed imports `@workspace/db`, whose barrel does `export * from "./schema"` (a directory import). Node 24's ESM resolver throws `ERR_UNSUPPORTED_DIR_IMPORT` on that, and `--packages=external` keeps the workspace pkg unbundled so it still fails.

**Rule:** run the seed via the package `seed` script, which bundles with esbuild `--format=cjs --external:pg-native --external:*.node` then runs the output. ESM output hits "Dynamic require of events" from pg — use CJS.

**Why:** lib/db exports raw `.ts` (no build step / dist), so the consumer must bundle it.
