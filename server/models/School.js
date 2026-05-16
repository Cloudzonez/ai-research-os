import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    departments: [{ type: String }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);
