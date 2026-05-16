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
import crawlerRoutes from "./routes/crawlers.js";
import foundryRoutes from "./routes/foundry.js";

const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/crawlers", crawlerRoutes);
app.use("/api/foundry", foundryRoutes);

async function start() {
  console.log(`API Key configured: ${config.deepseekApiKey ? "Yes" : "No"}`);
  console.log(`DeepSeek Base URL: ${config.deepseekBaseUrl}`);

  try {
    await mongoose.connect(config.mongoUri);
    console.log(`MongoDB connected: ${config.mongoUri}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.log("Starting without database...");
  }

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`API: http://localhost:${config.port}/api/health`);
  });
}

start();

export default app;
