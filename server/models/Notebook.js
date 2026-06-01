import mongoose from "mongoose";

const studioArtifactSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "audio_overview",
        "slide_deck",
        "video_overview",
        "mind_map",
        "report",
        "flashcards",
        "quiz",
        "infographic",
        "data_table",
      ],
      required: true,
    },
    title: { type: String, default: "" },
    content: { type: mongoose.Schema.Types.Mixed, default: null },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const sourceSchema = new mongoose.Schema(
  {
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: "Paper", default: null },
    title: { type: String, required: true },
    type: { type: String, enum: ["pdf", "text", "url", "paper"], default: "paper" },
    googleSourceId: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const notebookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    coverImage: { type: String, default: "" },

    // Strict owner isolation — each user sees only their own notebooks
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Google Cloud NotebookLM Enterprise workspace ID
    // REQUIRED: no notebook exists locally without a matching Google workspace
    googleCloudWorkspaceId: {
      type: String,
      required: true,
      unique: true,
    },

    // Sources synced to Google Cloud
    sources: [sourceSchema],

    // Studio artifacts generated via the Google API (saved locally for instant reload)
    studioArtifacts: [studioArtifactSchema],

    // User notes added in the Studio panel
    notes: [
      {
        content: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    sourceCount: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notebookSchema.index({ owner: 1, updatedAt: -1 });
notebookSchema.index({ owner: 1, lastAccessed: -1 });

export default mongoose.model("Notebook", notebookSchema);
