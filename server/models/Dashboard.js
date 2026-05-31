import mongoose from "mongoose";

const dashboardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    jsonData: { type: String, default: "" },
    htmlContent: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sharing: {
      type: String,
      enum: ["private", "school", "university"],
      default: "school",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Dashboard", dashboardSchema);
