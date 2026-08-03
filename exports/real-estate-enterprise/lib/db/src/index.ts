import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

/**
 * Production lives in the `public` schema; the isolated testing sandbox lives in
 * the `demo` schema of the *same* Postgres instance. Both are real, persistent
 * schemas — demo is never in-memory. Each pool pins its connections to the right
 * schema via the libpq `search_path` startup option, so the same table names
 * resolve to the correct schema with zero query rewriting. `demo,public` lets
 * demo fall back to shared types/extensions that only exist in `public`.
 */
export const PROD_SCHEMA = "public";
export const DEMO_SCHEMA = "demo";

const prodPool = new Pool({
  connectionString,
  options: `-c search_path=${PROD_SCHEMA}`,
});

const demoPool = new Pool({
  connectionString,
  options: `-c search_path=${DEMO_SCHEMA},${PROD_SCHEMA}`,
});

const prodDb = drizzle(prodPool, { schema });
const demoDb = drizzle(demoPool, { schema });

type DrizzleDb = NodePgDatabase<typeof schema>;
export type Tenant = "production" | "demo";

/**
 * Per-request tenant selection. Set via `runWithTenant` around the request
 * lifecycle (see the auth middleware). When no context is established — the
 * default and any unknown/background path — reads and writes resolve to
 * production, so the sandbox can never leak into prod by accident.
 */
const tenantStore = new AsyncLocalStorage<Tenant>();

export function runWithTenant<T>(tenant: Tenant, fn: () => T): T {
  return tenantStore.run(tenant, fn);
}

export function activeTenant(): Tenant {
  return tenantStore.getStore() ?? "production";
}

function activeDb(): DrizzleDb {
  return activeTenant() === "demo" ? demoDb : prodDb;
}

/**
 * Back-compat export. The standalone seed CLI ends this pool when it finishes;
 * it always targets production (the demo pool is only ended at process exit,
 * which the long-running server never reaches during normal operation).
 */
export const pool = prodPool;

/** Raw production pool, for the rare structural DDL that must bypass tenant routing. */
export const prodRawPool = prodPool;

/**
 * `db` is a transparent proxy over the *active* drizzle instance. Every property
 * access (select/insert/update/delete/transaction/execute/query/...) is forwarded
 * to whichever instance the current AsyncLocalStorage tenant selects, captured at
 * call time. This keeps all ~56 consumers importing the same `db` binding while
 * routing each request to production or demo. Functions are bound to their owning
 * instance so chained builders and transactions stay on the right connection.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const active = activeDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(active, prop, receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as DrizzleDb;

export * from "./schema";
