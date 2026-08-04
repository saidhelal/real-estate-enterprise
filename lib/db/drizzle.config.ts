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
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
