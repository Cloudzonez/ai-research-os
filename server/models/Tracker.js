import mongoose from "mongoose";

const trackerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    cadence: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly"],
      default: "Daily",
    },
    papers: { type: Number, default: 0 },
    sources: [{ type: String }],
    signals: [{ type: String }],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },
    subscribers: { type: Number, default: 1 },
    lastRun: { type: Date, default: Date.now },
    keywords: [String],
    crawlStatus: {
      type: String,
      enum: ["idle", "running", "completed", "partial", "failed"],
      default: "idle",
    },
    lastCrawlQuery: { type: String, default: "" },
    lastCrawlErrors: [{ source: String, error: String }],
    lastCrawledPaperIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Paper" }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Tracker", trackerSchema);
