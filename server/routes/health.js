import { Router } from "express";
import mongoose from "mongoose";
import { config } from "../config.js";

const router = Router();

router.get("/", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  res.json({
    status: "ok",
    db: states[dbState] || "unknown",
    model: config.model,
    uptime: process.uptime(),
    nodeEnv: config.nodeEnv,
  });
});

export default router;
