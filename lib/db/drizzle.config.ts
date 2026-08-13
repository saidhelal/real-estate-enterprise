import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // drizzle-kit resolves `schema` as a glob pattern, and glob treats a backslash
  // as an escape character — so the native Windows separators that path.join
  // produces make the pattern match nothing ("No schema files found"). POSIX
  // separators work on both platforms.
  schema: path.join(__dirname, "./src/schema/index.ts").split(path.sep).join("/"),
  // Forward-only migration history. Until now the schema reached a database only
  // through `drizzle-kit push`, which diffs live state and applies the change in
  // place: no recorded history, no rollback point, and no way for a second
  // database (the `demo` schema, a fresh clone, a future deployment) to be
  // brought to a known state. Emitting SQL here makes each schema change a
  // reviewable, replayable artifact.
  // Relative, unlike `schema` above: drizzle-kit resolves `out` against the
  // config's own directory, so an absolute path is concatenated onto it and
  // produces "lib/db/F:/…/lib/db/migrations".
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
