import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

export const config = {
  // Core application
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  
  // Database
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/ai_research",
  
  // Authentication
  authSecret: process.env.AUTH_SECRET || "dev-secret-change-in-production",
  
  // Storage
  storagePath: process.env.STORAGE_PATH || "./uploads",
  
  // DeepSeek AI
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  model: process.env.MODEL_NAME || "deepseek-v4-pro",
  
  // Task-specific model routing
  chatModel: process.env.CHAT_MODEL || process.env.MODEL_NAME || "deepseek-v4-pro",
  codeModel: process.env.CODE_MODEL || "deepseek-v4-pro",
  crawlerModel: process.env.CRAWLER_MODEL || process.env.CODE_MODEL || "deepseek-v4-pro",
  summaryModel: process.env.SUMMARY_MODEL || process.env.MODEL_NAME || "deepseek-v4-pro",
  
  // Discovery & Search - Embeddings
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-large",
  embeddingDimensions: 1536,
  
  // Discovery & Search - External APIs
  openAlexEmail: process.env.OPENALEX_EMAIL || "research@example.com",
  semanticScholarApiKey: process.env.SEMANTIC_SCHOLAR_API_KEY || "",
  pubmedEmail: process.env.PUBMED_EMAIL || process.env.OPENALEX_EMAIL || "research@example.com",
  
  // Discovery & Search - Caching
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  searchCacheTtl: parseInt(process.env.SEARCH_CACHE_TTL) || 300,
  
  // Discovery & Search - Performance
  maxConcurrentSources: parseInt(process.env.MAX_CONCURRENT_SOURCES) || 5,
  searchTimeout: parseInt(process.env.SEARCH_TIMEOUT) || 15000,
  titleSimilarityThreshold: parseFloat(process.env.TITLE_SIMILARITY_THRESHOLD) || 0.95,
  embeddingSimilarityThreshold: parseFloat(process.env.EMBEDDING_SIMILARITY_THRESHOLD) || 0.92,
};
