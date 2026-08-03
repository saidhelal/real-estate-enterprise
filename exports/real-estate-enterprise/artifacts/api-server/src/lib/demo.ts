import { sql } from "drizzle-orm";
import { db, runWithTenant, DEMO_SCHEMA } from "@workspace/db";
import { seedAll, seedConfig } from "../seed";

/**
 * Isolated Testing Environment ("demo") provisioning and lifecycle.
 *
 * The demo sandbox is a real, persistent Postgres schema (`demo`) living in the
 * same instance as production (`public`). Its tables are an exact structural
 * mirror of production, created with `LIKE public.* INCLUDING ALL` (columns,
 * defaults, not-null, primary/unique/check constraints and indexes). Foreign
 * keys are intentionally not mirrored — the seed inserts in dependency order, so
 * demo data stays consistent without cross-table FK enforcement, and dropping a
 * schema with self-contained tables is simpler and order-independent.
 *
 * Structural DDL is pinned to the production connection (search_path=public)
 * regardless of the caller's ambient tenant; the schema names are always
 * fully-qualified so this is unambiguous. Seeding is pinned to the demo tenant
 * so every `db` write inside the (tenant-agnostic) seed lands in `demo`.
 */

const TABLE_MIRROR_SQL = sql.raw(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.%I (LIKE public.%I INCLUDING ALL)',
      r.tablename, r.tablename
    );
  END LOOP;
END $$;
`);

/** Create the demo schema and mirror every production table into it. Idempotent. */
export async function provisionDemoSchema(): Promise<void> {
  await runWithTenant("production", async () => {
    await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${DEMO_SCHEMA}`));
    await db.execute(TABLE_MIRROR_SQL);
  });
}

/** True once the demo sandbox has been seeded with sample data. */
async function demoHasData(): Promise<boolean> {
  return runWithTenant("production", async () => {
    const result = await db.execute(
      sql.raw(`SELECT count(*)::int AS n FROM ${DEMO_SCHEMA}.companies`),
    );
    const rows = (result.rows ?? result) as Array<{ n: number }>;
    return (rows[0]?.n ?? 0) > 0;
  });
}

/**
 * Ensure the demo sandbox exists and holds sample data. Provisioning and the
 * seed are both idempotent, so this is cheap to call on every "enter testing"
 * and only runs the (slower) seed the first time the sandbox is empty.
 */
export async function ensureDemoReady(): Promise<void> {
  await provisionDemoSchema();
  if (!(await demoHasData())) {
    await runWithTenant("demo", () => seedAll());
  }
}

/**
 * One-click reset: drop the demo schema entirely, recreate its structure from
 * the current production schema, and reseed. This also re-syncs any structural
 * drift (new tables/columns added to production since the last provision).
 */
export async function resetDemo(): Promise<void> {
  await runWithTenant("production", async () => {
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${DEMO_SCHEMA} CASCADE`));
    await db.execute(sql.raw(`CREATE SCHEMA ${DEMO_SCHEMA}`));
  });
  await provisionDemoSchema();
  await runWithTenant("demo", () => seedAll());
}

/**
 * Owner "Reset Demo": rebuild the demo sandbox into a clean, fully-configured but
 * EMPTY state — exactly like a brand-new installation. Drops the demo schema,
 * recreates its structure from the current production schema, then runs the
 * config-only seed (see seedConfig) so every setup surface is present and no
 * business / transactional data remains. DDL is pinned to the production
 * connection and seeding to the demo tenant, so this can never touch production
 * data — it only ever rewrites the isolated `demo` schema.
 */
export async function resetDemoConfigOnly(): Promise<void> {
  await runWithTenant("production", async () => {
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${DEMO_SCHEMA} CASCADE`));
    await db.execute(sql.raw(`CREATE SCHEMA ${DEMO_SCHEMA}`));
  });
  await provisionDemoSchema();
  await runWithTenant("demo", () => seedConfig());
}
