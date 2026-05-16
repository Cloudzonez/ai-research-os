import mongoose from "mongoose";

const generatedAppSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    appSpec: { type: mongoose.Schema.Types.Mixed, default: {} },
    template: { type: String, enum: ["literature_roadmap", "data_dashboard", "project_checklist", "knowledge_base", "custom"], default: "custom" },
    sourceArtifacts: [{ type: String }],
    generatedCode: { type: String, default: "" },
    previewUrl: String,
    publishedUrl: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sharingScope: { type: String, enum: ["private", "project", "school", "university"], default: "school" },
    expiryPolicy: { type: String, enum: ["never", "30d", "90d", "365d"], default: "365d" },
    approvalState: { type: String, enum: ["draft", "pending", "approved", "denied"], default: "draft" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    auditLog: [{ action: String, user: mongoose.Schema.Types.ObjectId, timestamp: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

export default mongoose.model("GeneratedApp", generatedAppSchema);
