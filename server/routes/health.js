import { Router } from "express";
import mongoose from "mongoose";
import { config } from "../config.js";
import { getDbState, getLogStats } from "../services/logger.js";

const router = Router();

router.get("/", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  const logStats = await getLogStats().catch((err) => ({ error: err.message }));
  const db = states[dbState] || "unknown";
  res.json({
    status: db === "connected" ? "ok" : "degraded",
    db,
    dbState: getDbState(),
    model: config.model,
    uptime: process.uptime(),
    nodeEnv: config.nodeEnv,
    pid: process.pid,
    logging: {
      persistLogs: config.persistLogs,
      verbose: config.devVerboseLogging,
      level: config.logLevel,
      storage: logStats.storage || "unknown",
      memoryCount: logStats.memoryCount,
      pendingCount: logStats.pendingCount,
    },
    warnings: db === "connected"
      ? []
      : ["MongoDB is not connected. API writes will not persist reliably, so frontend data can disappear after refresh."],
  });
});

export default router;
