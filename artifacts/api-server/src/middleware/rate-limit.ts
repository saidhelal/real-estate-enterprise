import type { Request, Response, NextFunction } from "express";

/**
 * Request rate limiting.
 *
 * The only brute-force control before this was per-account lockout (5 failures
 * → 15 minutes). That stops an attacker grinding one account, but does nothing
 * against credential stuffing, which spreads a few attempts across thousands of
 * accounts and never trips any single lockout. It also left every other
 * endpoint — report aggregation, exports, the AI routes — with no ceiling at
 * all.
 *
 * Fixed-window counters held in process memory. That is the right scope here:
 * the API is a single Node process with no Redis and no horizontal scaling, so
 * a shared store would add an operational dependency without changing the
 * outcome. If the deployment ever runs more than one instance, this becomes
 * per-instance and the store has to move — that is the one assumption to revisit.
 */

interface Bucket {
  count: number;
  /** Epoch ms at which this window expires and the count resets. */
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests permitted per key per window. */
  max: number;
  /** Distinguishes one limiter's buckets from another's. */
  scope: string;
  /**
   * Only count requests that failed. Used on login so a person working
   * normally is never throttled, while an attacker guessing passwords is.
   */
  countOnlyFailures?: boolean;
  message?: string;
}

// One map per process, shared by every limiter; entries are namespaced by scope.
const buckets = new Map<string, Bucket>();

/**
 * Drop expired entries so the map cannot grow without bound under a hostile
 * source-address spread. Unref'd: a pending sweep must never hold the process
 * open during a graceful shutdown.
 */
const SWEEP_INTERVAL_MS = 60_000;
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS);
sweeper.unref();

/** Exposed for tests; not part of the request path. */
export function _resetRateLimitState(): void {
  buckets.clear();
}

/**
 * Identify the caller. Falls back to a constant when no address is available so
 * an unidentifiable client is still bounded rather than unlimited — failing
 * closed is the safer default for a limiter.
 */
function clientKey(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, scope, countOnlyFailures = false, message } = options;
  const body = message ?? "Too many requests. Please try again shortly.";

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const key = `${scope}:${clientKey(req)}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    // A route can pass through more than one limiter — the auth endpoints are
    // covered by both the tight credential budget and the general API budget.
    // The first limiter to run is the most specific one and is the binding
    // constraint, so it owns the advertised headers; a later, looser limiter
    // must not overwrite them or the response would report a budget of 600 on a
    // route that actually cuts off at 10.
    const alreadyAdvertised = res.getHeader("RateLimit-Limit") !== undefined;

    if (bucket.count >= max) {
      // A rejection always describes itself, even if an earlier limiter had
      // already written its (now irrelevant) allowance.
      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", String(retryAfterSec));
      res.setHeader("Retry-After", String(retryAfterSec));
      // Logged at warn: a sustained 429 stream is an attack signal, and the
      // metrics middleware already counts the status class.
      req.log?.warn({ scope, key, max, windowMs }, "Rate limit exceeded");
      res.status(429).json({ error: body });
      return;
    }

    if (countOnlyFailures) {
      // Charge the bucket only once the handler has answered, and only when it
      // rejected the attempt. A correct password never consumes budget, so a
      // shared office NAT cannot lock out legitimate staff.
      res.once("finish", () => {
        if (res.statusCode >= 400) {
          const current = buckets.get(key);
          if (current && current.resetAt > Date.now()) current.count += 1;
        }
      });
    } else {
      bucket.count += 1;
    }

    if (!alreadyAdvertised) {
      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
      res.setHeader("RateLimit-Reset", String(retryAfterSec));
    }
    next();
  };
}

/**
 * Credential endpoints. Deliberately failure-only and tight: it takes far fewer
 * than 10 wrong passwords to know a human is not at the keyboard, while a real
 * user who mistypes twice and then succeeds is never charged.
 */
export const authRateLimit = rateLimit({
  scope: "auth",
  windowMs: 15 * 60_000,
  max: 10,
  countOnlyFailures: true,
  message: "Too many failed sign-in attempts. Please try again in a few minutes.",
});

/**
 * Everything else. High enough that the dense screens — which fan out to
 * several list endpoints on load — never approach it, low enough to bound a
 * scripted scrape.
 */
export const apiRateLimit = rateLimit({
  scope: "api",
  windowMs: 60_000,
  max: 600,
});
