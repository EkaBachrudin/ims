import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { router } from "./routes";
import { Errors } from "./lib/errors";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", router);

  app.use((_req, _res, next) => next(Errors.notFound("Route")));
  app.use(errorHandler);

  return app;
}
