import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["author", "venue", "keyword", "topic"],
      required: true,
    },
    // For author subscriptions
    authorName: String,
    authorId: String, // ORCID, Semantic Scholar ID, etc.
    
    // For venue subscriptions
    venueName: String,
    venueISSN: String,
    
    // For keyword/topic subscriptions
    keywords: [String],
    query: String,
    
    // Notification settings
    frequency: {
      type: String,
      enum: ["immediate", "daily", "weekly"],
      default: "weekly",
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    
    // Tracking
    lastChecked: Date,
    lastNotified: Date,
    newPapersCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ userId: 1, type: 1 });
subscriptionSchema.index({ enabled: 1, lastChecked: 1 });

export default mongoose.model("Subscription", subscriptionSchema);

// Made with Bob
