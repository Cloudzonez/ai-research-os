import mongoose from "mongoose";

const toolDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    inputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    permissionScope: {
      type: String,
      enum: ["public", "authenticated", "admin"],
      default: "authenticated",
    },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    sideEffectLevel: { type: String, enum: ["none", "read", "write", "delete"], default: "read" },
    auditPolicy: { type: String, enum: ["none", "log", "approve"], default: "log" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    version: { type: String, default: "1.0.0" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ToolDefinition", toolDefinitionSchema);
