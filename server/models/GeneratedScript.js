import mongoose from "mongoose";

const generatedScriptSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    language: { type: String, enum: ["python", "r", "sql", "javascript"], default: "javascript" },
    inputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
    dependencies: [{ type: String }],
    command: String,
    code: { type: String, default: "" },
    sandboxResult: {
      status: String,
      output: String,
      error: String,
      duration: Number,
    },
    tests: [{ input: mongoose.Schema.Types.Mixed, expectedOutput: String, description: String }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sharingScope: { type: String, enum: ["private", "project", "school", "university"], default: "school" },
    version: { type: String, default: "1.0.0" },
  },
  { timestamps: true }
);

export default mongoose.model("GeneratedScript", generatedScriptSchema);
