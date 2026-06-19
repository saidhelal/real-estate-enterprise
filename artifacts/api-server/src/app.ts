import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { governanceMiddleware } from "./middleware/governance";
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

export default app;
