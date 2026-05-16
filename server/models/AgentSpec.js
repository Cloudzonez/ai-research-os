import mongoose from "mongoose";

const agentSpecSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    purpose: { type: String, required: true },
    instructions: { type: String, default: "" },
    allowedTools: [{ type: String }],
    inputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    approvalPolicy: { type: String, enum: ["auto", "manual", "admin"], default: "auto" },
    maxSteps: { type: Number, default: 10 },
    maxCost: { type: Number, default: 50000 }, // max tokens per run
    evalSuiteId: { type: mongoose.Schema.Types.ObjectId, ref: "EvalSuite", default: null },
    active: { type: Boolean, default: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("AgentSpec", agentSpecSchema);
