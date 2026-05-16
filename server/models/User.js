import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },
    role: { type: String, enum: ["teacher", "admin"], default: "teacher" },
    language: { type: String, enum: ["zh", "en"], default: "zh" },
    quota: { type: Number, default: 1000000 }, // tokens per month
    quotaUsed: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ schoolId: 1 });

export default mongoose.model("User", userSchema);
