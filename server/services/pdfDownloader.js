import Paper from "../models/Paper.js";
import * as storage from "./storage.js";

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const DELAY_BETWEEN_DOWNLOADS_MS = 800;

// Known open-access hosts that allow programmatic PDF access
const ALLOWED_HOSTS = [
  "arxiv.org",
  "export.arxiv.org",
  "openaccess.thecvf.com",   // CVF (CVPR, ICCV, etc.)
  "cv-foundation.org",
  "openreview.net",
  "proceedings.neurips.cc",
  "proceedings.mlr.press",   // PMLR / ICML
  "aclanthology.org",        // ACL / EMNLP / NAACL
  "ceur-ws.org",
  "biorxiv.org",
  "medrxiv.org",
  "api.openalex.org",
  "pdfs.semanticscholar.org",
];

function isAllowedHost(url) {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith("." + allowed));
  } catch {
    return false;
  }
}

function safeFilename(paper) {
  const base = (paper.title || "paper").replace(/[^a-zA-Z0-9一-鿿_-]/g, "_").slice(0, 80);
  return `${Date.now()}_${base}.pdf`;
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "AI-Research-OS/0.1 (mailto:research@university.edu)",
          Accept: "application/pdf",
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Download a single PDF for a paper.
 *
 * @param {object} paper - Paper document (must have _id, title)
 * @param {string} pdfUrl - URL of the PDF to download
 * @returns {object} { success, pdfPath?, error? }
 */
export async function downloadPaperPdf(paper, pdfUrl) {
  if (!pdfUrl || !paper?._id) {
    return { success: false, error: "Missing pdfUrl or paper._id" };
  }

  // Skip if paper already has a PDF
  if (paper.pdfPath) {
    return { success: true, pdfPath: paper.pdfPath, skipped: true };
  }

  // Only download from known open-access hosts
  if (!isAllowedHost(pdfUrl)) {
    return { success: false, error: `Host not in allowed list: ${pdfUrl}` };
  }

  try {
    const buffer = await fetchWithRetry(pdfUrl);

    if (!buffer || buffer.length < 100) {
      return { success: false, error: "Downloaded file too small or empty" };
    }

    // Verify PDF magic bytes
    const header = buffer.slice(0, 5).toString();
    if (!header.startsWith("%PDF")) {
      return { success: false, error: "File does not appear to be a valid PDF" };
    }

    const filename = safeFilename(paper);
    const pdfPath = await storage.put(filename, buffer);

    // Update the paper record with the pdfPath
    await Paper.findByIdAndUpdate(paper._id, { pdfPath });

    return { success: true, pdfPath };
  } catch (err) {
    return { success: false, error: err.message || "Download failed" };
  }
}

/**
 * Download PDFs for multiple papers with rate-limiting delays.
 *
 * @param {Array<{paper: object, pdfUrl: string}>} items
 * @returns {object} { results, downloaded, skipped, failed }
 */
export async function downloadBatchPdfs(items) {
  const results = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const { paper, pdfUrl } of items) {
    const result = await downloadPaperPdf(paper, pdfUrl);
    results.push({ paperId: paper._id?.toString(), ...result });

    if (result.skipped) skipped++;
    else if (result.success) downloaded++;
    else failed++;

    // Rate-limit between downloads
    if (items.length > 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_DOWNLOADS_MS));
    }
  }

  return { results, downloaded, skipped, failed };
}

export default { downloadPaperPdf, downloadBatchPdfs, ALLOWED_HOSTS, isAllowedHost };
