import { describe, it, expect, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { rateLimit, _resetRateLimitState } from "./rate-limit";

/**
 * Behavioural tests for the limiter. These exist because a rate limiter that
 * stops limiting fails silently — nothing errors, traffic just flows — so the
 * invariants have to be asserted rather than observed.
 */

type FinishHandler = () => void;

function makeReq(ip = "10.0.0.1"): Request {
  return { ip, socket: {}, log: undefined } as unknown as Request;
}

/** Minimal Response double that records status, body, headers and `finish`. */
function makeRes() {
  const headers: Record<string, string> = {};
  const finishHandlers: FinishHandler[] = [];
  const res = {
    statusCode: 200,
    headers,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    getHeader(name: string): string | undefined {
      return headers[name];
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    once(event: string, handler: FinishHandler) {
      if (event === "finish") finishHandlers.push(handler);
      return res;
    },
    /** Simulate the response completing with the given status. */
    finish(code: number) {
      res.statusCode = code;
      for (const h of finishHandlers) h();
    },
  };
  return res;
}

function run(mw: ReturnType<typeof rateLimit>, req: Request, res: ReturnType<typeof makeRes>) {
  let passed = false;
  mw(req, res as unknown as Response, () => {
    passed = true;
  });
  return passed;
}

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimitState());

  it("allows requests up to the limit and rejects the one after", () => {
    const mw = rateLimit({ scope: "t1", windowMs: 60_000, max: 3 });
    const req = makeReq();

    for (let i = 0; i < 3; i++) {
      expect(run(mw, req, makeRes())).toBe(true);
    }

    const res = makeRes();
    expect(run(mw, req, res)).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBeDefined();
    expect(res.headers["RateLimit-Remaining"]).toBe("0");
  });

  it("keeps separate budgets per client address", () => {
    const mw = rateLimit({ scope: "t2", windowMs: 60_000, max: 1 });

    expect(run(mw, makeReq("10.0.0.1"), makeRes())).toBe(true);
    expect(run(mw, makeReq("10.0.0.1"), makeRes())).toBe(false);
    // A different caller must be unaffected by the first one's exhaustion.
    expect(run(mw, makeReq("10.0.0.2"), makeRes())).toBe(true);
  });

  it("keeps separate budgets per scope", () => {
    const a = rateLimit({ scope: "auth-scope", windowMs: 60_000, max: 1 });
    const b = rateLimit({ scope: "api-scope", windowMs: 60_000, max: 1 });
    const req = makeReq();

    expect(run(a, req, makeRes())).toBe(true);
    expect(run(a, req, makeRes())).toBe(false);
    // Exhausting the auth budget must not consume the general API budget.
    expect(run(b, req, makeRes())).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const mw = rateLimit({ scope: "t3", windowMs: 30, max: 1 });
    const req = makeReq();

    expect(run(mw, req, makeRes())).toBe(true);
    expect(run(mw, req, makeRes())).toBe(false);

    await new Promise((r) => setTimeout(r, 45));
    expect(run(mw, req, makeRes())).toBe(true);
  });

  describe("countOnlyFailures", () => {
    it("does not charge successful responses", () => {
      const mw = rateLimit({
        scope: "t4",
        windowMs: 60_000,
        max: 2,
        countOnlyFailures: true,
      });
      const req = makeReq();

      // Ten successful sign-ins from one office NAT must never be throttled.
      for (let i = 0; i < 10; i++) {
        const res = makeRes();
        expect(run(mw, req, res)).toBe(true);
        res.finish(200);
      }
      expect(run(mw, req, makeRes())).toBe(true);
    });

    it("charges failed responses and locks out after the limit", () => {
      const mw = rateLimit({
        scope: "t5",
        windowMs: 60_000,
        max: 2,
        countOnlyFailures: true,
      });
      const req = makeReq();

      for (let i = 0; i < 2; i++) {
        const res = makeRes();
        expect(run(mw, req, res)).toBe(true);
        res.finish(401);
      }

      const blocked = makeRes();
      expect(run(mw, req, blocked)).toBe(false);
      expect(blocked.statusCode).toBe(429);
    });
  });

  it("lets the first (most specific) limiter own the advertised headers", () => {
    // Mirrors production: auth routes pass through the tight credential limiter
    // and then the loose general one. The response must advertise the budget
    // that actually binds, not the last one that ran.
    const tight = rateLimit({ scope: "chain-tight", windowMs: 60_000, max: 10 });
    const loose = rateLimit({ scope: "chain-loose", windowMs: 60_000, max: 600 });
    const req = makeReq();
    const res = makeRes();

    run(tight, req, res);
    run(loose, req, res);

    expect(res.headers["RateLimit-Limit"]).toBe("10");
  });

  it("a rejection always advertises its own budget", () => {
    const tight = rateLimit({ scope: "chain-reject", windowMs: 60_000, max: 1 });
    const req = makeReq();

    run(tight, req, makeRes());
    const res = makeRes();
    res.setHeader("RateLimit-Limit", "600"); // a looser limiter got there first
    expect(run(tight, req, res)).toBe(false);
    expect(res.headers["RateLimit-Limit"]).toBe("1");
  });

  it("still bounds a client whose address cannot be determined", () => {
    const mw = rateLimit({ scope: "t6", windowMs: 60_000, max: 1 });
    const anonymous = { socket: {} } as unknown as Request;

    expect(run(mw, anonymous, makeRes())).toBe(true);
    // Fails closed: unidentifiable callers share one bucket rather than bypassing.
    expect(run(mw, anonymous, makeRes())).toBe(false);
  });
});
