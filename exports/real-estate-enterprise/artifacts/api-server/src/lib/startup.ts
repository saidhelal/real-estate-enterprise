import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Startup diagnostics + automatic recovery for recoverable failures.
 *
 * Runs before the HTTP server begins accepting traffic. Validates required
 * configuration and verifies database connectivity, retrying transient DB
 * failures with exponential backoff so a database that is briefly unavailable
 * at boot (a common, recoverable condition) does not permanently fail startup.
 */

export interface DiagnosticResult {
  name: string;
  ok: boolean;
  detail?: string;
  durationMs: number;
}

export interface StartupReport {
  ok: boolean;
  results: DiagnosticResult[];
}

export interface DbRecoveryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const REQUIRED_ENV = ["DATABASE_URL", "SESSION_SECRET", "PORT"] as const;

function checkEnv(): DiagnosticResult {
  const start = Date.now();
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  return {
    name: "environment",
    ok: missing.length === 0,
    detail:
      missing.length > 0
        ? `missing: ${missing.join(", ")}`
        : `all ${REQUIRED_ENV.length} required variables present`,
    durationMs: Date.now() - start,
  };
}

async function pingDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

async function checkDatabaseWithRecovery(
  opts: DbRecoveryOptions,
): Promise<DiagnosticResult> {
  const retries = opts.retries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 8000;
  const start = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pingDatabase();
      return {
        name: "database",
        ok: true,
        detail:
          attempt === 1 ? "connected" : `connected after ${attempt} attempts`,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        logger.warn(
          { attempt, retries, delayMs: delay, err },
          "Database not ready; retrying (automatic recovery)",
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    name: "database",
    ok: false,
    detail:
      lastError instanceof Error ? lastError.message : String(lastError),
    durationMs: Date.now() - start,
  };
}

export async function runStartupDiagnostics(
  opts: DbRecoveryOptions = {},
): Promise<StartupReport> {
  const results: DiagnosticResult[] = [];
  results.push(checkEnv());
  results.push(await checkDatabaseWithRecovery(opts));

  for (const result of results) {
    const payload = {
      check: result.name,
      ok: result.ok,
      detail: result.detail,
      durationMs: result.durationMs,
    };
    if (result.ok) {
      logger.info(payload, `Startup check passed: ${result.name}`);
    } else {
      logger.error(payload, `Startup check failed: ${result.name}`);
    }
  }

  const ok = results.every((result) => result.ok);
  if (ok) {
    logger.info({ ok }, "Startup diagnostics passed");
  } else {
    logger.error({ ok }, "Startup diagnostics FAILED");
  }
  return { ok, results };
}
