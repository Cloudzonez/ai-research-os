import mongoose from "mongoose";

const eroSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    sourceData: [{ name: String, uri: String, size: Number, type: { type: String } }],
    transformedData: [{ name: String, uri: String }],
    scripts: [{ type: mongoose.Schema.Types.ObjectId, ref: "GeneratedScript" }],
    environment: { type: mongoose.Schema.Types.Mixed, default: { language: "python" } },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputs: [{ name: String, type: String, uri: String, description: String }],
    evidenceLinks: [{ claim: String, source: String, paperId: mongoose.Schema.Types.ObjectId }],
    writingFragments: [{ section: String, text: String, citations: [String] }],
    replayStatus: { type: String, enum: ["not_run", "running", "passed", "failed", "divergent"], default: "not_run" },
    auditLog: [{ action: String, timestamp: { type: Date, default: Date.now }, details: mongoose.Schema.Types.Mixed }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sharingScope: { type: String, enum: ["private", "project", "school", "university"], default: "school" },
  },
  { timestamps: true }
);

export default mongoose.model("ExecutableResearchObject", eroSchema);
