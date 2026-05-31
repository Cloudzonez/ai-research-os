import mongoose from "mongoose";

const systemLogSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ["debug", "info", "warn", "error"],
      index: true,
      required: true,
    },
    namespace: { type: String, default: "app", index: true },
    event: { type: String, default: "", index: true },
    message: { type: String, default: "", index: true },
    requestId: { type: String, default: "", index: true },
    method: { type: String, default: "" },
    path: { type: String, default: "", index: true },
    statusCode: { type: Number, default: null },
    durationMs: { type: Number, default: null },
    userId: { type: String, default: "", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: {
      name: { type: String, default: "" },
      message: { type: String, default: "" },
      stack: { type: String, default: "" },
    },
    dbState: { type: String, default: "" },
    pid: { type: Number, default: null },
  },
  { timestamps: true }
);

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ level: 1, createdAt: -1 });
systemLogSchema.index({ namespace: 1, createdAt: -1 });

export default mongoose.models.SystemLog || mongoose.model("SystemLog", systemLogSchema);
