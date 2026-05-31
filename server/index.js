import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
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
import adminRoutes from "./routes/admin.js";
import sessionRoutes from "./routes/sessions.js";
import searchRoutes from "./routes/search.js";
import User from "./models/User.js";

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
app.use("/api/admin", adminRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/search", searchRoutes);

async function seedDemoUser() {
  try {
    const demoUsers = [
      {
        email: "admin@university.edu",
        name: "Demo Admin",
        role: "admin",
        password: "demo123456",
      },
      {
        email: "teacher@university.edu",
        name: "Demo Teacher",
        role: "teacher",
        password: "demo123456",
      },
    ];

    for (const u of demoUsers) {
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        const passwordHash = await bcrypt.hash(u.password, 12);
        await User.create({
          email: u.email,
          passwordHash,
          name: u.name,
          role: u.role,
          language: "zh",
          active: true,
        });
        console.log(`Demo user created: ${u.email} / ${u.password} (${u.role})`);
      } else {
        console.log(`Demo user already exists: ${u.email}`);
      }
    }
  } catch (err) {
    console.error("Failed to seed demo user:", err.message);
  }
}

async function start() {
  console.log(`API Key configured: ${config.deepseekApiKey ? "Yes" : "No"}`);
  console.log(`DeepSeek Base URL: ${config.deepseekBaseUrl}`);

  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${config.mongoUri}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.log("Attempting in-memory MongoDB fallback...");
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      console.log(`In-memory MongoDB connected: ${memUri}`);
    } catch (memErr) {
      console.error("In-memory MongoDB also failed:", memErr.message);
      console.log("Starting without database...");
    }
  }

  // Seed demo user after database connection
  if (mongoose.connection.readyState === 1) {
    await seedDemoUser();
  }

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`API: http://localhost:${config.port}/api/health`);
  });
}

start();

export default app;
