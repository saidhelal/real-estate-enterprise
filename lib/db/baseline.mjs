/**
 * Baseline an existing database against the migration history.
 *
 * Until migrations existed, schema reached this database through
 * `drizzle-kit push`, which applies a diff in place and records nothing. The
 * tables are therefore already present, but the migration journal is empty —
 * so `drizzle-kit migrate` would try to CREATE TABLE over live tables and fail.
 *
 * This records the already-applied migrations as applied *without executing
 * them*, which is the standard way to adopt a migration history on a database
 * that predates it. It is:
 *   - non-destructive: it issues no DDL against business tables and no DML
 *     against business rows;
 *   - idempotent: re-running skips entries already recorded;
 *   - safe on a fresh database only if the schema really is present — it
 *     refuses to baseline when the expected tables are missing, because that
 *     would leave a database marked "migrated" with nothing in it.
 *
 * After baselining, every future schema change is `pnpm --filter @workspace/db
 * run generate` followed by `… run migrate`, and a brand-new database is built
 * by running the journal from 0000 forward.
 *
 * Usage: node --env-file-if-exists=../../.env baseline.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(here, "migrations");
const JOURNAL = path.join(MIGRATIONS_DIR, "meta", "_journal.json");

// A table that must exist for the baseline claim to be true. If the database is
// empty this is absent and we refuse rather than lie about the schema state.
const SENTINEL_TABLE = "users";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
if (!existsSync(JOURNAL)) {
  console.error(`No migration journal at ${JOURNAL}. Run \`generate\` first.`);
  process.exit(1);
}

/**
 * Drizzle identifies an applied migration by the SHA-256 of the raw .sql file
 * content — not by filename — so the hash must be computed exactly that way or
 * `migrate` will consider the migration outstanding and try to re-apply it.
 */
function hashOf(tag) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
  return createHash("sha256").update(sql).digest("hex");
}

async function main() {
  const journal = JSON.parse(readFileSync(JOURNAL, "utf8"));
  const entries = journal.entries ?? [];
  if (entries.length === 0) {
    console.log("Journal is empty — nothing to baseline.");
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const present = await client.query(
      "select 1 from information_schema.tables where table_schema = 'public' and table_name = $1",
      [SENTINEL_TABLE],
    );
    if (present.rowCount === 0) {
      console.error(
        `Refusing to baseline: table "${SENTINEL_TABLE}" is not present, so this ` +
          `database has not actually had the schema applied. Run \`migrate\` on ` +
          `the empty database instead — it will build the schema from the journal.`,
      );
      process.exitCode = 1;
      return;
    }

    // Drizzle's own bookkeeping location. Created with the same shape the
    // node-postgres migrator uses, so `migrate` reads it natively afterwards.
    await client.query('create schema if not exists "drizzle"');
    await client.query(`
      create table if not exists "drizzle"."__drizzle_migrations" (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    let recorded = 0;
    let skipped = 0;

    for (const entry of entries) {
      const hash = hashOf(entry.tag);
      const already = await client.query(
        'select 1 from "drizzle"."__drizzle_migrations" where hash = $1',
        [hash],
      );
      if (already.rowCount > 0) {
        console.log(`  skip    ${entry.tag} (already recorded)`);
        skipped++;
        continue;
      }
      await client.query(
        'insert into "drizzle"."__drizzle_migrations" (hash, created_at) values ($1, $2)',
        [hash, entry.when],
      );
      console.log(`  record  ${entry.tag}`);
      recorded++;
    }

    console.log(
      `\nBaseline complete — ${recorded} recorded, ${skipped} already present. ` +
        `No DDL or DML was executed against business tables.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Baseline failed:", err.message);
  process.exit(1);
});
