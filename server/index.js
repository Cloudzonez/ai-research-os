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
import {
  createLogger,
  errorLoggingMiddleware,
  flushMemoryLogs,
  installConsoleLogCapture,
  requestLoggingMiddleware,
} from "./services/logger.js";
import { startScheduler } from "./services/scheduler.js";

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
  if (!config.deepseekApiKey) {
    logger.error("DEEPSEEK_API_KEY is not configured. AI features will not work.", {
      event: "config_missing_deepseek_key",
    });
    if (config.nodeEnv === "production") {
      process.exit(1);
    }
  }

  if (config.nodeEnv === "production" && config.authSecret === "dev-secret-change-in-production") {
    logger.error("AUTH_SECRET is still set to the default dev value. Set a secure secret in production.", {
      event: "config_insecure_auth_secret",
    });
    process.exit(1);
  }

  logger.info("Server boot", {
    event: "server_boot",
    port: config.port,
    nodeEnv: config.nodeEnv,
    deepseekApiKeyConfigured: Boolean(config.deepseekApiKey),
    deepseekBaseUrl: config.deepseekBaseUrl,
    persistLogs: config.persistLogs,
    logLevel: config.logLevel,
  });

  let mongoConnected = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
      mongoConnected = true;
      break;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/3 failed`, {
        event: "mongo_connect_failed",
        error: err.message,
      });
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  if (!mongoConnected) {
    logger.warn("Starting without persistent database. Some features will be unavailable.", {
      event: "mongo_connect_all_failed",
    });
  }

  app.listen(config.port, () => {
    logger.info("Server listening", {
      event: "server_listening",
      url: `http://localhost:${config.port}`,
      healthUrl: `http://[::1]:${config.port}/api/health`,
      logsUrl: `http://[::1]:${config.port}/api/logs`,
    });

    if (mongoConnected) {
      startScheduler(logger);
    }
  });
}

start();

export default app;
