import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import publicLegalRouter from "./routes/public-legal";
import { governanceMiddleware } from "./middleware/governance";
import { tenantContext } from "./middleware/auth";
import objectUploadRouter from "./routes/object-upload";
import { apiRateLimit, authRateLimit } from "./middleware/rate-limit";
import { metricsMiddleware } from "./lib/metrics";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(metricsMiddleware);
app.use(compression());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting, ahead of every business route. Credential endpoints get their
// own much tighter, failure-only budget: account lockout alone stops an attacker
// grinding ONE account but not credential stuffing spread across many, and the
// two auth realms share this ceiling because they share a signing secret.
// Mounted before the health probes are matched, but those live on the router
// below and an orchestrator polling /healthz stays far inside the general limit.
app.use("/api/auth/login", authRateLimit);
app.use("/api", apiRateLimit);

// Public, unauthenticated contract verification (QR target). Mounted BEFORE the
// governance gate and the auth-gated /api router so external scanners can read
// non-confidential verification data without a session.
app.use("/api/legal-verify", publicLegalRouter);

// File uploads. Authorised by the signed handle in the URL, not by a session
// header, because the browser PUTs the file with no headers of its own — the
// same reason cloud storage issues signed URLs. Mounted before the auth gate
// for that, and inert without a valid handle.
app.use("/api", objectUploadRouter);

// Which schema this request reads and writes. Mounted before governance, which
// writes change requests of its own: while the tenant was chosen further down
// inside requireAuth, governance ran outside the context and parked every
// sandbox change request in production.
app.use("/api", tenantContext);

// Governance gate: converts direct DELETEs and protected PATCHes into pending
// change requests (202). Mounted under /api BEFORE the routers. Internal
// approval re-dispatches carry a secret header and pass straight through.
app.use("/api", governanceMiddleware);

app.use("/api", router);

// JSON 404 for unmatched API routes.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

/**
 * Postgres error codes that mean "the client sent something malformed", not
 * "the server is broken". Without this they surface as 500s, which tells an
 * operator to go looking for a fault that does not exist and tells a caller
 * to retry a request that will never succeed.
 *
 * 22P02 is by far the common one: any route taking an id in the path or query
 * hands it straight to a `uuid` comparison, so `/documents-file?documentId=..%2F..`
 * — or simply a truncated id pasted from a log — reached the driver and threw.
 */
const CLIENT_ERROR_CODES: Record<string, { status: number; error: string }> = {
  "22P02": { status: 400, error: "Malformed value in the request." }, // invalid text representation
  "22001": { status: 400, error: "A value in the request is too long." },
  "23503": { status: 409, error: "A referenced record does not exist." }, // FK violation
  "23505": { status: 409, error: "That record already exists." }, // unique violation
};

function pgCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  // Drizzle wraps the driver error; the original keeps the code.
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }
  return undefined;
}

// Centralized error handler (must declare all four args). Prevents a thrown or
// rejected handler error in any one module from crashing the process or leaking
// internals to clients — Express 5 forwards rejected async handlers here too.
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (res.headersSent) return;

    const mapped = CLIENT_ERROR_CODES[pgCode(err) ?? ""];
    if (mapped) {
      // Logged at warn, not error: a bad id is a caller problem and should not
      // sit in the same bucket as a real fault when someone reads the logs.
      req.log?.warn({ err }, "Rejected malformed request");
      res.status(mapped.status).json({ error: mapped.error });
      return;
    }

    req.log?.error({ err }, "Unhandled request error");
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
