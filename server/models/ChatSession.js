import mongoose from "mongoose";
import crypto from "crypto";

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New Chat", maxlength: 200 },
    isMarked: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    shareToken: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// Generate a share token when sharing is enabled
chatSessionSchema.methods.generateShareToken = function () {
  if (!this.shareToken) {
    this.shareToken = crypto.randomBytes(16).toString("hex");
  }
  return this.shareToken;
};

export default mongoose.model("ChatSession", chatSessionSchema);
