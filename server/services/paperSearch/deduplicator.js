import { cleanText, cleanDoi } from "./normalizer.js";

export class PaperDeduplicator {
  constructor(options = {}) {
    this.paperStore = options.paperStore || null;
    this.strictMode = options.strictMode ?? false;
  }

  async deduplicate(papers) {
    const unique = [];
    const duplicates = [];
    const seen = new Set();

    for (const paper of papers) {
      const identity = paperIdentity(paper);
      if (seen.has(identity)) {
        duplicates.push({ paper, existingInDb: null, matchReason: `in-batch:${identity}` });
        continue;
      }
      seen.add(identity);

      if (this.paperStore) {
        const existing = await this.findExisting(paper);
        if (existing) {
          await this.mergeInto(paper, existing);
          duplicates.push({ paper, existingInDb: existing, matchReason: "db-match" });
          continue;
        }
      }

      unique.push(paper);
    }

    return { unique, duplicates };
  }

  async findExisting(paper) {
    if (!this.paperStore) return null;

    if (paper.doi) {
      const byDoi = await this.paperStore.findOne({ doi: cleanDoi(paper.doi) });
      if (byDoi) return byDoi;
    }

    const sourceIds = paper.sourceIds || {};
    if (sourceIds.doi) {
      const bySourceDoi = await this.paperStore.findOne({ "sourceIds.doi": sourceIds.doi });
      if (bySourceDoi) return bySourceDoi;
    }
    if (sourceIds.openalex) {
      const byOa = await this.paperStore.findOne({ "sourceIds.openalex": sourceIds.openalex });
      if (byOa) return byOa;
    }
    if (sourceIds.semanticScholar) {
      const byS2 = await this.paperStore.findOne({ "sourceIds.semanticScholar": sourceIds.semanticScholar });
      if (byS2) return byS2;
    }
    if (sourceIds.arxiv) {
      const byArxiv = await this.paperStore.findOne({ "sourceIds.arxiv": sourceIds.arxiv });
      if (byArxiv) return byArxiv;
    }
    if (sourceIds.pubmed) {
      const byPm = await this.paperStore.findOne({ "sourceIds.pubmed": sourceIds.pubmed });
      if (byPm) return byPm;
    }

    if (!this.strictMode && paper.title) {
      const normTitle = cleanText(paper.title).toLowerCase();
      const existing = await this.paperStore.findOne({ title: { $regex: new RegExp(`^${escapeRegex(normTitle)}$`, "i") } });
      if (existing) {
        if (paper.year && existing.year && paper.year !== existing.year) return null;
        return existing;
      }
    }

    return null;
  }

  async mergeInto(paper, existing) {
    const sourceIds = { ...(existing.sourceIds || {}), ...(paper.sourceIds || {}) };
    const updates = { sourceIds };
    if (paper.abstract && !existing.abstract) updates.abstract = paper.abstract;
    if (paper.pdfUrl && !existing.pdfUrl) updates.pdfUrl = paper.pdfUrl;
    if (paper.citedByCount > (existing.citedByCount || 0)) updates.citedByCount = paper.citedByCount;
    if (paper.year && !existing.year) updates.year = paper.year;

    if (this.paperStore && typeof this.paperStore.findByIdAndUpdate === "function") {
      await this.paperStore.findByIdAndUpdate(existing._id || existing.id, { $set: updates });
    }

    return { ...existing, ...updates };
  }
}

export function paperIdentity(paper) {
  if (paper.doi) {
    return `doi:${cleanDoi(paper.doi).toLowerCase()}`;
  }

  const title = cleanText(paper.title || "").toLowerCase().replace(/[^a-z0-9一-鿿]/g, " ").replace(/\s+/g, " ").trim();
  const year = paper.year || "";

  if (!this?.strictMode && title) {
    const firstAuthor = (paper.authors?.[0] || "").split(" ").pop() || "";
    return `title-auth-yr:${title}|${firstAuthor.toLowerCase()}|${year}`;
  }

  return `title-yr:${title}|${year}`;
}

export function deduplicateBatch(papers, { strict } = {}) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  for (const paper of papers) {
    const identity = paperIdentity(paper);
    if (seen.has(identity)) {
      duplicates.push(paper);
    } else {
      seen.add(identity);
      unique.push(paper);
    }
  }

  return { unique, duplicates };
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default { PaperDeduplicator, paperIdentity, deduplicateBatch };
