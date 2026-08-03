import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { getModuleSummary } from "../lib/module-registry";
import { getMetrics } from "../lib/metrics";

const router: IRouter = Router();

// Basic health (OpenAPI contract). Kept stable for existing consumers.
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Liveness: the process is up and able to serve. No external dependencies are
// checked, so an orchestrator only restarts on a truly dead process.
router.get("/livez", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

// Readiness: safe to receive traffic. Verifies DB connectivity and that every
// module mounted successfully. Returns 503 when a dependency is unhealthy.
router.get("/readyz", async (_req, res) => {
  const modules = getModuleSummary();
  const start = Date.now();
  let dbOk = false;
  let dbError: string | undefined;
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      dbOk = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const ready = dbOk && modules.failed === 0;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "unavailable",
    checks: {
      database: {
        ok: dbOk,
        latencyMs: Date.now() - start,
        ...(dbError ? { error: dbError } : {}),
      },
      modules,
    },
  });
});

// Operational performance metrics snapshot (in-memory, bounded).
router.get("/metrics", (_req, res) => {
  res.json(getMetrics());
});

export default router;
