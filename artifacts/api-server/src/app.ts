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
import { governanceMiddleware } from "./middleware/governance";
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

// Governance gate: converts direct DELETEs and protected PATCHes into pending
// change requests (202). Mounted under /api BEFORE the routers. Internal
// approval re-dispatches carry a secret header and pass straight through.
app.use("/api", governanceMiddleware);

app.use("/api", router);

// JSON 404 for unmatched API routes.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler (must declare all four args). Prevents a thrown or
// rejected handler error in any one module from crashing the process or leaking
// internals to clients — Express 5 forwards rejected async handlers here too.
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    req.log?.error({ err }, "Unhandled request error");
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
