import type { Server } from "node:http";
import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { runStartupDiagnostics } from "./lib/startup";
import { getModuleSummary } from "./lib/module-registry";

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

async function main(): Promise<void> {
  const report = await runStartupDiagnostics();
  if (!report.ok) {
    logger.error("Startup diagnostics failed; aborting startup");
    process.exit(1);
  }

  const modules = getModuleSummary();
  if (modules.failed > 0) {
    logger.warn(
      modules,
      "Some modules failed to mount; continuing with the rest",
    );
  } else {
    logger.info(modules, `All ${modules.total} modules mounted`);
  }

  const server = app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });

  registerProcessHandlers(server);
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
