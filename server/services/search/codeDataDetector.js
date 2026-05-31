const CODE_PATTERNS = [
  /github\.com\/[\w-]+\/[\w-]+/gi,
  /gitlab\.com\/[\w-]+\/[\w-]+/gi,
  /bitbucket\.org\/[\w-]+\/[\w-]+/gi,
  /\bcode available\b/i,
  /\bsource code\b/i,
  /\bimplementation\b.*\bavailable\b/i,
];

const DATA_PATTERNS = [
  /zenodo\.org\/record\/\d+/gi,
  /figshare\.com\/articles\/[\w\/]+/gi,
  /osf\.io\/[\w]+/gi,
  /\bdata available\b/i,
  /\bdataset.*\bavailable\b/i,
  /\bsupplementary.*\bdata\b/i,
];

const DATASET_REGISTRY = [
  "ImageNet", "COCO", "MNIST", "CIFAR-10", "CIFAR-100",
  "MIMIC-III", "MIMIC-IV", "PhysioNet", "UK Biobank",
  "1000 Genomes", "TCGA", "GEO", "PubChem", "ChEMBL",
  "UniProt", "PDB", "GenBank", "GLUE", "SQuAD",
  "MS MARCO", "Common Crawl", "Wikipedia", "arXiv"
];

/**
 * Detect code availability in text
 * @param {string} text - Text to analyze
 * @returns {Object} { available, urls }
 */
export function detectCodeAvailability(text) {
  if (!text) return { available: false, urls: [] };

  const urls = [];
  for (const pattern of CODE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  return {
    available: urls.length > 0,
    urls: [...new Set(urls)],
  };
}

/**
 * Detect data availability in text
 * @param {string} text - Text to analyze
 * @returns {Object} { available, urls }
 */
export function detectDataAvailability(text) {
  if (!text) return { available: false, urls: [] };

  const urls = [];
  for (const pattern of DATA_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  return {
    available: urls.length > 0,
    urls: [...new Set(urls)],
  };
}

/**
 * Detect mentioned datasets in text
 * @param {string} text - Text to analyze
 * @returns {Array} Array of detected datasets
 */
export function detectDatasets(text) {
  if (!text) return [];

  const found = [];
  const lowerText = text.toLowerCase();

  for (const dataset of DATASET_REGISTRY) {
    if (lowerText.includes(dataset.toLowerCase())) {
      found.push({
        name: dataset,
        description: `Mentioned in paper`,
      });
    }
  }

  return found;
}

/**
 * Enrich paper with code/data detection
 * @param {Object} paper - Paper object
 * @returns {Object} Enrichment data
 */
export function enrichWithCodeData(paper) {
  const fullText = `${paper.title} ${paper.abstract} ${paper.text || ""}`;

  const code = detectCodeAvailability(fullText);
  const data = detectDataAvailability(fullText);
  const datasets = detectDatasets(fullText);

  return {
    codeAvailable: code.available,
    codeUrls: code.urls,
    dataAvailable: data.available,
    dataUrls: data.urls,
    datasets,
  };
}

export default {
  detectCodeAvailability,
  detectDataAvailability,
  detectDatasets,
  enrichWithCodeData,
};

// Made with Bob
