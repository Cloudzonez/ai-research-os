import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

export const config = {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/ai_research",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  model: process.env.MODEL_NAME || "deepseek-v4-pro",
  nodeEnv: process.env.NODE_ENV || "development",
  authSecret: process.env.AUTH_SECRET || "dev-secret-change-in-production",
  storagePath: process.env.STORAGE_PATH || "./uploads",
  // Task-specific model routing
  chatModel: process.env.CHAT_MODEL || process.env.MODEL_NAME || "deepseek-v4-pro",
  codeModel: process.env.CODE_MODEL || "deepseek-v4-pro",
  crawlerModel: process.env.CRAWLER_MODEL || process.env.CODE_MODEL || "deepseek-v4-pro",
  summaryModel: process.env.SUMMARY_MODEL || process.env.MODEL_NAME || "deepseek-v4-pro",
  openAlexEmail: process.env.OPENALEX_EMAIL || "research@example.com",
};
