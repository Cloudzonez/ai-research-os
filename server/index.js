import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { config } from "./config.js";
import chatRoutes from "./routes/chat.js";
import paperRoutes from "./routes/papers.js";
import trackerRoutes from "./routes/trackers.js";
import writingRoutes from "./routes/writing.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import approvalRoutes from "./routes/approvals.js";
import mcpRoutes from "./routes/mcp.js";
import foundryRoutes from "./routes/foundry.js";
import dashboardRoutes from "./routes/dashboards.js";
import logRoutes from "./routes/logs.js";
import sessionRoutes from "./routes/sessions.js";
import adminRoutes from "./routes/admin.js";
import {
  createLogger,
  errorLoggingMiddleware,
  flushMemoryLogs,
  installConsoleLogCapture,
  requestLoggingMiddleware,
} from "./services/logger.js";

installConsoleLogCapture();
const logger = createLogger("server");

const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174", "http://[::1]:5173", "http://[::1]:5174"], credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLoggingMiddleware);

// Serve uploaded files
app.use("/uploads", express.static(config.storagePath));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/mcp", mcpRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/papers", paperRoutes);
app.use("/api/trackers", trackerRoutes);
app.use("/api/writing", writingRoutes);
app.use("/api/foundry", foundryRoutes);
app.use("/api/dashboards", dashboardRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/admin", adminRoutes);
app.use(errorLoggingMiddleware);

mongoose.connection.on("connected", () => {
  logger.info("MongoDB connected", { event: "mongo_connected", mongoUri: config.mongoUri });
  flushMemoryLogs();
});
mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected", { event: "mongo_disconnected" });
});
mongoose.connection.on("error", (err) => {
  logger.error("MongoDB connection error", { event: "mongo_error", error: err });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { event: "unhandled_rejection", error: reason });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { event: "uncaught_exception", error: err });
});

async function start() {
  logger.info("Server boot", {
    event: "server_boot",
    port: config.port,
    nodeEnv: config.nodeEnv,
    deepseekApiKeyConfigured: Boolean(config.deepseekApiKey),
    deepseekBaseUrl: config.deepseekBaseUrl,
    persistLogs: config.persistLogs,
    logLevel: config.logLevel,
  });

  try {
    await mongoose.connect(config.mongoUri);
  } catch (err) {
    logger.error("MongoDB connection failed; starting without persistent database", {
      event: "mongo_connect_failed",
      mongoUri: config.mongoUri,
      error: err,
    });
  }

  app.listen(config.port, () => {
    logger.info("Server listening", {
      event: "server_listening",
      url: `http://localhost:${config.port}`,
      healthUrl: `http://[::1]:${config.port}/api/health`,
      logsUrl: `http://[::1]:${config.port}/api/logs`,
    });
  });
}

start();

export default app;
