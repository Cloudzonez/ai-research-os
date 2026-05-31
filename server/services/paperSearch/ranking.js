export function rankPapers(papers, options = {}) {
  const {
    citationWeight = 0.3,
    recencyWeight = 0.2,
    keywordMatchWeight = 0.3,
    venueWeight = 0.1,
    oaWeight = 0.1,
    keywords = [],
  } = options;

  const now = new Date().getFullYear();

  return papers
    .map((paper) => {
      let score = 0;

      const citations = paper.citedByCount || 0;
      score += citationWeight * Math.min(1, Math.log10(citations + 1) / Math.log10(1000));

      const age = now - (paper.year || now);
      score += recencyWeight * Math.max(0, 1 - age / 10);

      if (keywords.length > 0 && (paper.title || paper.abstract)) {
        const text = `${paper.title || ""} ${paper.abstract || ""}`.toLowerCase();
        const matchCount = keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
        score += keywordMatchWeight * (matchCount / Math.max(1, keywords.length));
      }

      score += venueWeight * venueScore(paper.venue);

      if (paper.pdfUrl) score += oaWeight;

      return { ...paper, _score: Math.round(score * 100) };
    })
    .sort((a, b) => b._score - a._score);
}

function venueScore(venue) {
  if (!venue) return 0.3;
  const v = String(venue).toLowerCase();
  const top = /\b(nature|science|cell|neurips|icml|iclr|cvpr|acl|emnlp|naacl|pmlr|ijcai|aaai|www|sigir|chi|pnas|jmlr|ieee trans|acm trans)\b/i;
  const mid = /\b(springer|elsevier|wiley|arxiv|preprint|workshop|symposium|conference|journal|proceedings)\b/i;
  if (top.test(v)) return 1.0;
  if (mid.test(v)) return 0.5;
  return 0.2;
}

export default { rankPapers };
