import mongoose from "mongoose";
import Paper from "../models/Paper.js";
import { batchGenerateEmbeddings } from "../services/search/embeddingService.js";
import { config } from "../config.js";

/**
 * Generate embeddings for all papers without embeddings
 */
export async function embedAllPapers() {
  console.log("Starting paper embedding job...");

  try {
    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
      console.log("Connected to MongoDB");
    }

    // Find papers without embeddings
    const papers = await Paper.find({
      $or: [
        { embedding: null },
        { embedding: { $exists: false } }
      ]
    }).limit(1000); // Process in batches of 1000

    if (papers.length === 0) {
      console.log("No papers to embed");
      return { processed: 0, success: 0, failed: 0 };
    }

    console.log(`Found ${papers.length} papers to embed`);

    // Prepare texts
    const texts = papers.map(p => 
      `${p.title} ${p.abstract || ""}`.slice(0, 8000)
    );

    // Generate embeddings in batch
    console.log("Generating embeddings...");
    const embeddings = await batchGenerateEmbeddings(texts);

    // Update papers
    let successCount = 0;
    let failedCount = 0;

    const updates = papers.map((paper, index) => {
      if (embeddings[index]) {
        successCount++;
        return {
          updateOne: {
            filter: { _id: paper._id },
            update: {
              $set: {
                embedding: embeddings[index],
                embeddingModel: "text-embedding-3-large",
                embeddedAt: new Date()
              }
            }
          }
        };
      } else {
        failedCount++;
        return null;
      }
    }).filter(Boolean);

    if (updates.length > 0) {
      await Paper.bulkWrite(updates);
    }

    console.log(`Embedding complete: ${successCount} success, ${failedCount} failed`);
    
    return {
      processed: papers.length,
      success: successCount,
      failed: failedCount
    };
  } catch (error) {
    console.error("Embedding job error:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  embedAllPapers()
    .then((result) => {
      console.log("Job completed:", result);
      process.exit(0);
    })
    .catch(err => {
      console.error("Job failed:", err);
      process.exit(1);
    });
}

export default embedAllPapers;

// Made with Bob
