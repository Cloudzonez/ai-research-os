import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    kind: { type: String, enum: ["tracker", "pdf", "write", "crawler", "general"], default: "general" },
    text: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    sessionId: { type: mongoose.Schema.Types.Mixed, default: "default", index: true },
    route: {
      view: String,
      icon: String,
      steps: [{ type: String }],
    },
    contextBundle: {
      tokens: Number,
      artifacts: Number,
      allowedPercent: Number,
      papers: [{ title: String, source: String, tags: [String] }],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
