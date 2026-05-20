import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./log.js";
import { memwalRouter } from "./routes/memwal.js";
import { sealRouter } from "./routes/seal.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mnemo-sidecar", version: "0.0.1" });
});

app.use("/memwal", memwalRouter);
app.use("/seal", sealRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "unhandled");
  res.status(500).json({ error: "internal_error", message: err.message });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  logger.info({ port }, "mnemo-sidecar listening");
});
