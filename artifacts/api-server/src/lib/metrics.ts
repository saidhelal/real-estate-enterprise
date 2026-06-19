import type { Request, Response, NextFunction } from "express";

/**
 * Lightweight in-memory performance monitoring. Aggregates request throughput,
 * error rate, and latency, and keeps a bounded sample of slow requests. All
 * structures are fixed-size (counters + a capped ring of slow samples) so the
 * collector itself cannot leak memory over a long-running process.
 */

const SLOW_REQUEST_MS = 1000;
const MAX_SLOW_SAMPLES = 50;

interface SlowSample {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  at: string;
}

const state = {
  startedAt: Date.now(),
  total: 0,
  errors: 0,
  totalMs: 0,
  maxMs: 0,
  byStatusClass: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 } as Record<
    string,
    number
  >,
  slow: [] as SlowSample[],
};

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    state.total += 1;
    state.totalMs += durationMs;
    if (durationMs > state.maxMs) state.maxMs = durationMs;

    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    if (statusClass in state.byStatusClass) {
      state.byStatusClass[statusClass] += 1;
    }
    if (res.statusCode >= 500) state.errors += 1;

    if (durationMs >= SLOW_REQUEST_MS) {
      state.slow.push({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        at: new Date().toISOString(),
      });
      // Bounded ring: drop the oldest sample so memory stays fixed.
      if (state.slow.length > MAX_SLOW_SAMPLES) state.slow.shift();
    }
  });
  next();
}

export function getMetrics() {
  const mem = process.memoryUsage();
  return {
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    requests: {
      total: state.total,
      errors: state.errors,
      errorRate:
        state.total > 0
          ? Number((state.errors / state.total).toFixed(4))
          : 0,
      avgMs: state.total > 0 ? Math.round(state.totalMs / state.total) : 0,
      maxMs: Math.round(state.maxMs),
      byStatusClass: state.byStatusClass,
    },
    slowThresholdMs: SLOW_REQUEST_MS,
    slowRequests: state.slow,
    memory: {
      rssMb: Math.round(mem.rss / 1048576),
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
      heapTotalMb: Math.round(mem.heapTotal / 1048576),
    },
  };
}
