import mongoose from "mongoose";
import { config } from "../config.js";
import { dequeue, completeJob, failJob, getQueueStats } from "../services/queue.js";
import Paper from "../models/Paper.js";

async function run() {
  console.log("Worker starting...");

  try {
    await mongoose.connect(config.mongoUri);
    console.log("Worker connected to MongoDB");
  } catch (err) {
    console.error("Worker MongoDB connection failed:", err.message);
    process.exit(1);
  }

  const handledTypes = ["parse_pdf", "summarize_paper"];

  async function tick() {
    try {
      const job = await dequeue(handledTypes);
      if (!job) return;

      console.log(`Processing job ${job._id}: ${job.type}`);

      try {
        let result;
        switch (job.type) {
          case "parse_pdf":
            result = await handleParsePdf(job.payload);
            break;
          case "summarize_paper":
            result = await handleSummarizePaper(job.payload);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }
        await completeJob(job._id, result);
        console.log(`Job ${job._id} completed`);
      } catch (err) {
        console.error(`Job ${job._id} failed:`, err.message);
        await failJob(job._id, err.message);
      }
    } catch (err) {
      console.error("Worker tick error:", err.message);
    }
  }

  // Poll every 2 seconds
  setInterval(tick, 2000);
  console.log("Worker running, polling every 2s");

  // Health reporting
  setInterval(async () => {
    const stats = await getQueueStats();
    console.log("Queue stats:", stats);
  }, 60000);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Worker shutting down...");
    await mongoose.disconnect();
    process.exit(0);
  });
}

export async function handleParsePdf({ paperId }, deps = {}) {
  const PaperModel = deps.PaperModel || Paper;

  const paper = await PaperModel.findById(paperId);
  if (!paper || !paper.pdfPath) {
    throw new Error("Paper not found or no PDF path");
  }

  const fs = await import("node:fs");
  const pdfParse = deps.pdfParse || (await import("pdf-parse")).default;

  let pdfBuffer;
  if (deps.readFileSync) {
    pdfBuffer = deps.readFileSync(paper.pdfPath);
  } else {
    pdfBuffer = fs.readFileSync(paper.pdfPath);
  }

  const data = await pdfParse(pdfBuffer);

  paper.text = data.text.slice(0, 50000);
  paper.status = "parsed";
  if (paper.save) {
    await paper.save();
  }

  return { textLength: data.text.length, pageCount: data.numpages };
}

export async function handleSummarizePaper({ paperId }, deps = {}) {
  const PaperModel = deps.PaperModel || Paper;
  const chatFn = deps.chat || (await import("../services/deepseek.js")).chat;

  const paper = await PaperModel.findById(paperId);
  if (!paper || !paper.text) {
    throw new Error("Paper not found or no text extracted");
  }

  const prompt = `Analyze this research paper text and return a JSON object with: summary (2-3 sentence academic summary), contributions (key contributions as array of strings), methods (research methods used), limitations (stated or apparent limitations).

Paper text: ${paper.text.slice(0, 8000)}

Return ONLY valid JSON: {"summary":"...","contributions":["..."],"methods":"...","limitations":"..."}`;

  const result = await chatFn([{ role: "user", content: prompt }], "en");
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  const analysis = JSON.parse(jsonMatch[0]);
  paper.summary = analysis.summary || "";
  paper.contributions = Array.isArray(analysis.contributions) ? analysis.contributions.join("; ") : (analysis.contributions || "");
  paper.methods = analysis.methods || "";
  paper.limitations = analysis.limitations || "";
  paper.status = "summarized";
  if (paper.save) {
    await paper.save();
  }

  return { paperId, status: "summarized" };
}

// Only auto-start when running as the main worker process (not when imported for tests)
const isMainModule = process.argv[1] && (process.argv[1].endsWith("runner.js") || process.argv[1].endsWith("runner"));
if (isMainModule || process.env.START_WORKER === "1") {
  run();
}
