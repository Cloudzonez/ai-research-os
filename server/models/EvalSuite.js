import mongoose from "mongoose";

const evalSuiteSchema = new mongoose.Schema(
  {
    taskType: { type: String, required: true },
    testCases: [
      {
        input: mongoose.Schema.Types.Mixed,
        expectedProperties: mongoose.Schema.Types.Mixed,
        description: String,
      },
    ],
    graders: [{ type: String, enum: ["exact_match", "contains", "schema_valid", "llm_judge"] }],
    regressionHistory: [
      {
        runAt: { type: Date, default: Date.now },
        passed: Number,
        failed: Number,
        total: Number,
        score: Number,
        model: String,
      },
    ],
    failureExamples: [{ type: mongoose.Schema.Types.Mixed }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("EvalSuite", evalSuiteSchema);
