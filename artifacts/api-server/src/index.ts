import type { Server } from "node:http";
import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { runStartupDiagnostics } from "./lib/startup";
import { getModuleSummary } from "./lib/module-registry";
import { startScheduler, stopScheduler } from "./lib/scheduler";
import { registerScheduledTasks } from "./lib/scheduled-tasks";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function registerProcessHandlers(server: Server): void {
  let shuttingDown = false;
  const shutdown = (signal: string, code = 0): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal, code }, "Graceful shutdown started");
    // Stop the tick before draining so no new task run starts against a pool
    // that is about to close. In-flight handlers finish on their own.
    stopScheduler();
    server.close(() => {
      pool
        .end()
        .catch((err) => logger.error({ err }, "Error closing DB pool"))
        .finally(() => process.exit(code));
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(code === 0 ? 0 : 1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // After an uncaught error the process state may be corrupt; the per-request
  // Express error handler already contains in-flight request failures, so these
  // only fire for faults outside the request lifecycle. Log and shut down
  // cleanly so the supervisor restarts a fresh process (controlled recovery),
  // rather than serving traffic from a possibly-broken process.
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception; shutting down for restart");
    shutdown("uncaughtException", 1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error(
      { err: reason },
      "Unhandled promise rejection; shutting down for restart",
    );
    shutdown("unhandledRejection", 1);
  });
}

/**
 * Bind the HTTP port, tolerating a transient EADDRINUSE.
 *
 * On a workspace reopen the previous session's process can still hold the port
 * while it drains (graceful shutdown allows up to 10s). Node surfaces bind
 * failures as an `error` event on the server — NOT via the `listen` callback —
 * so without this handler an EADDRINUSE escalates to `uncaughtException` and the
 * process exits permanently, leaving the API dead until a manual restart.
 * Retrying gives the old process time to release the port so a cold start
 * becomes ready on its own.
 */
function startServerWithRetry(attempt = 1): void {
  const maxAttempts = 6;
  const retryDelayMs = 2000;
  const server = app.listen(port);

  server.once("listening", () => {
    logger.info({ port, attempt }, "Server listening");
    registerProcessHandlers(server);
    // Started only after the port is open, and non-blocking by construction:
    // boot replay runs detached inside startScheduler, so a slow sweep can
    // never delay readiness and make a supervisor think startup failed.
    startScheduler();
  });

  server.once("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && attempt < maxAttempts) {
      logger.warn(
        { port, attempt, maxAttempts, retryDelayMs },
        "Port in use (a previous process is likely still shutting down); retrying",
      );
      setTimeout(() => startServerWithRetry(attempt + 1), retryDelayMs).unref();
      return;
    }
    logger.error({ err, port, attempt }, "Failed to bind port; aborting startup");
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const report = await runStartupDiagnostics();
  if (!report.ok) {
    logger.error("Startup diagnostics failed; aborting startup");
    process.exit(1);
  }

  // Registry is built before the server starts listening so the scheduler has a
  // complete task set the moment it starts.
  registerScheduledTasks();

  const modules = getModuleSummary();
  if (modules.failed > 0) {
    logger.warn(
      modules,
      "Some modules failed to mount; continuing with the rest",
    );
  } else {
    logger.info(modules, `All ${modules.total} modules mounted`);
  }

  startServerWithRetry();
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
