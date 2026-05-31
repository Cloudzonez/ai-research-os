import mongoose from "mongoose";
import { config } from "../config.js";
import { dequeue, completeJob, failJob, getQueueStats } from "../services/queue.js";
import Paper from "../models/Paper.js";
import { buildPaperAnalysisPrompt } from "../prompts/worker.js";

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 12;

async function connectWithRetry(attempt = 1) {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[worker] MongoDB connected (${config.mongoUri})`);
    return true;
  } catch (err) {
    console.error(`[worker] MongoDB connection failed (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}): ${err.message}`);
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[worker] Max reconnect attempts reached, exiting");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
    return connectWithRetry(attempt + 1);
  }
}

async function run() {
  console.log("[worker] Starting...");

  await connectWithRetry();

  mongoose.connection.on("disconnected", async () => {
    console.error("[worker] MongoDB disconnected unexpectedly, reconnecting...");
    await connectWithRetry();
  });

  const handledTypes = ["parse_pdf", "summarize_paper"];

  async function tick() {
    try {
      const job = await dequeue(handledTypes);
      if (!job) return;

      console.log(`[worker] Processing job ${job._id}: ${job.type}`);

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
        console.log(`[worker] Job ${job._id} completed`);
      } catch (err) {
        console.error(`[worker] Job ${job._id} failed:`, err.message);
        await failJob(job._id, err.message);
      }
    } catch (err) {
      console.error(`[worker] Tick error:`, err.message);
    }
  }

  setInterval(tick, 2000);
  console.log("[worker] Running, polling every 2s");

  setInterval(async () => {
    try {
      const stats = await getQueueStats();
      console.log("[worker] Queue stats:", stats);
    } catch {
      // stats collection is non-critical
    }
  }, 60000);

  process.on("SIGTERM", async () => {
    console.log("[worker] Shutting down...");
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
  const PDFParse = deps.PDFParse || (await import("pdf-parse")).PDFParse;

  let pdfBuffer;
  if (deps.readFileSync) {
    pdfBuffer = deps.readFileSync(paper.pdfPath);
  } else {
    pdfBuffer = fs.readFileSync(paper.pdfPath);
  }

  const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
  await parser.load({ data: pdfBuffer });
  const data = await parser.getText();

  paper.text = (data.text || "").slice(0, 50000);
  paper.status = "parsed";
  if (paper.save) {
    await paper.save();
  }

  return { textLength: data.text.length, pageCount: data.numpages };
}

export async function handleSummarizePaper({ paperId }, deps = {}) {
  const PaperModel = deps.PaperModel || Paper;
  const chatFn = deps.chat || (await import("../services/deepseek.js")).chat;
  const summarizePaperFn = deps.summarizePaper || (await import("../services/paperSummarizer.js")).summarizePaper;
  const generatePaperHTMLFn = deps.generatePaperHTML || (await import("../services/htmlRenderer.js")).generatePaperHTML;

  const paper = await PaperModel.findById(paperId);
  if (!paper) {
    throw new Error("Paper not found");
  }

  const locale = paper.tags?.some((t) => /[一-鿿]/.test(t)) ? "zh" : "en";

  if (paper.text && paper.text.length > 200) {
    const prompt = buildPaperAnalysisPrompt(paper.text);

    const result = await chatFn([{ role: "user", content: prompt }], "en");
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const analysis = JSON.parse(jsonMatch[0]);
    paper.summary = analysis.summary || "";
    paper.contributions = Array.isArray(analysis.contributions) ? analysis.contributions.join("; ") : (analysis.contributions || "");
    paper.methods = analysis.methods || "";
    paper.limitations = analysis.limitations || "";

    paper.aiSummary = {
      tldr: analysis.summary?.split(".")[0] + "." || analysis.summary || "",
      motivation: analysis.contributions || "",
      method: analysis.methods || "",
      result: "",
      conclusion: analysis.limitations || "",
    };
  }

  if (!paper.aiSummary?.tldr && (paper.abstract || paper.summary)) {
    paper.aiSummary = await summarizePaperFn(
      { title: paper.title, abstract: paper.abstract || paper.summary },
      locale
    );
  }

  if (paper.aiSummary?.tldr) {
    try {
      paper.htmlPage = await generatePaperHTMLFn(
        {
          title: paper.title,
          authors: paper.authors || [],
          abstract: paper.abstract || paper.summary || "",
          categories: paper.tags || [],
          url: paper.url || "",
          pdfUrl: paper.pdfUrl || (paper.url ? paper.url.replace("/abs/", "/pdf/") : ""),
          doi: paper.doi || "",
          aiSummary: paper.aiSummary,
        },
        locale
      );
      paper.htmlGeneratedAt = new Date();
    } catch (err) {
      console.warn(`[worker] HTML generation failed for ${paperId}: ${err.message}`);
    }
  }

  paper.status = "summarized";
  if (paper.save) {
    await paper.save();
  }

  return { paperId, status: "summarized", hasHtml: !!paper.htmlPage };
}

run();
