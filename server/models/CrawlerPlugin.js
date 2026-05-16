import mongoose from "mongoose";

const crawlerPluginSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    sourceConfig: {
      type: { type: String, enum: ["arxiv", "openalex", "semantic_scholar", "github", "custom_web", "rss"], default: "custom_web" },
      baseUrl: String,
      headers: { type: Map, of: String },
      rateLimit: { type: Number, default: 1000 }, // ms between requests
    },
    crawlerKind: { type: String, enum: ["standard", "generated_code"], default: "standard" },
    crawlerSpec: { type: mongoose.Schema.Types.Mixed, default: {} },
    parserCode: { type: String, default: "" },
    tests: [
      {
        input: String,
        expectedOutput: String,
        description: String,
      },
    ],
    sandboxLog: [
      {
        runAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["passed", "failed", "timeout", "error", "completed"] },
        output: String,
        error: String,
        duration: Number,
      },
    ],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sharingScope: {
      type: String,
      enum: ["private", "project", "school", "university"],
      default: "school",
    },
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: false },
    lastRun: Date,
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

crawlerPluginSchema.index({ owner: 1, active: 1 });
crawlerPluginSchema.index({ sharingScope: 1 });

export default mongoose.model("CrawlerPlugin", crawlerPluginSchema);
