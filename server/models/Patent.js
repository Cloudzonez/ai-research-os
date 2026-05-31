import mongoose from "mongoose";

const patentSchema = new mongoose.Schema(
  {
    // Inherit basic paper fields
    title: { type: String, required: true },
    abstract: String,
    authors: [String], // Called "inventors" in patents
    year: Number,
    url: String,
    
    // Patent-specific fields
    patentNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patentOffice: {
      type: String,
      enum: ["USPTO", "EPO", "JPO", "WIPO", "CNIPA", "KIPO"],
      required: true,
    },
    applicationNumber: String,
    applicationDate: Date,
    publicationDate: Date,
    grantDate: Date,
    
    // Inventors and assignees
    inventors: [String],
    assignee: String, // Company/institution
    assigneeType: {
      type: String,
      enum: ["company", "university", "government", "individual", "unknown"],
    },
    
    // Classifications
    classifications: {
      ipc: [String], // International Patent Classification
      cpc: [String], // Cooperative Patent Classification
      uspc: [String], // US Patent Classification
    },
    
    // Patent content
    claims: [String],
    description: String,
    
    // Legal status
    legalStatus: {
      type: String,
      enum: ["pending", "granted", "expired", "abandoned", "revoked"],
      default: "pending",
    },
    expirationDate: Date,
    
    // Related patents
    patentFamily: [String], // Related patent numbers
    priorArt: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paper",
    }],
    citedPatents: [String],
    citingPatents: [String],
    
    // External IDs
    externalIds: {
      uspto: String,
      epo: String,
      wipo: String,
      lens: String,
    },
    
    // Metadata
    source: {
      type: String,
      default: "patent",
    },
    itemType: {
      type: String,
      default: "patent",
    },
    language: String,
    pdfUrl: String,
    
    // Citation metrics
    citedByCount: {
      type: Number,
      default: 0,
    },
    forwardCitations: {
      type: Number,
      default: 0,
    },
    backwardCitations: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
patentSchema.index({ patentNumber: 1 });
patentSchema.index({ patentOffice: 1 });
patentSchema.index({ assignee: 1 });
patentSchema.index({ "classifications.ipc": 1 });
patentSchema.index({ "classifications.cpc": 1 });
patentSchema.index({ legalStatus: 1 });
patentSchema.index({ grantDate: -1 });
patentSchema.index({ title: "text", abstract: "text", description: "text" });

export default mongoose.model("Patent", patentSchema);

// Made with Bob
