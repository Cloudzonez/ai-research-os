import mongoose from "mongoose";

const paperRelationshipSchema = new mongoose.Schema(
  {
    sourcePaperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paper",
      required: true,
      index: true,
    },
    targetPaperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paper",
      required: true,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: [
        "contradicts",
        "replicates",
        "extends",
        "supports",
        "reviews",
        "applies",
        "cites",
        "unknown",
      ],
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },
    evidence: {
      type: String,
      required: true,
    },
    citationContext: String,
    extractedAt: {
      type: Date,
      default: Date.now,
    },
    extractionMethod: {
      type: String,
      enum: ["llm", "citation_context", "claim_comparison", "manual"],
      default: "llm",
    },
    metadata: {
      claimsCompared: Number,
      contradictionScore: Number,
      similarityScore: Number,
      methodologyMatch: Number,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
paperRelationshipSchema.index({ sourcePaperId: 1, relationshipType: 1 });
paperRelationshipSchema.index({ targetPaperId: 1, relationshipType: 1 });
paperRelationshipSchema.index({ sourcePaperId: 1, targetPaperId: 1 }, { unique: true });
paperRelationshipSchema.index({ confidence: -1 });

export default mongoose.model("PaperRelationship", paperRelationshipSchema);

// Made with Bob
