import mongoose from "mongoose";

const aiActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    model: { type: String, default: "deepseek-v4-pro" },
    inputText: String,
    outputText: String,
    tokensUsed: { type: Number, default: 0 },
    kind: { type: String, enum: ["tracker", "pdf", "write", "crawler", "general"] },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    approvalState: {
      type: String,
      enum: ["auto_approved", "pending", "approved", "denied"],
      default: "auto_approved",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    error: String,
    sessionId: { type: String, default: "default" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("AIAction", aiActionSchema);
