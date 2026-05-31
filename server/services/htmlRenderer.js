import { chat } from "./deepseek.js";
import {
  getHtmlPrompt,
  buildPaperInfoContent,
  buildPaperHtmlUserPrompt,
  getDigestPrompt,
  buildDigestUserPrompt,
} from "../prompts/htmlRenderer.js";

const HTML_FALLBACK_ZH = (paper) => `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${paper.title || "论文详情"}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;padding:2rem 1rem}
  .container{max-width:800px;margin:0 auto;background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:1.75rem;margin-bottom:.5rem;color:#0f172a}
  .authors{color:#64748b;margin-bottom:1rem}
  .tags{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}
  .tag{background:#eef2ff;color:#4f46e5;padding:.25rem .75rem;border-radius:999px;font-size:.875rem}
  .tldr{background:linear-gradient(135deg,#eef2ff,#f3e8ff);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;border-left:4px solid #6366f1}
  .tldr h2{font-size:1rem;color:#6366f1;margin-bottom:.5rem}
  section{margin-bottom:1.5rem}
  section h2{font-size:1.1rem;color:#334155;margin-bottom:.5rem}
  .abstract{border-top:1px solid #e2e8f0;padding-top:1rem;margin-top:1.5rem}
  .abstract summary{color:#6366f1;cursor:pointer;font-weight:600}
  .links{display:flex;gap:1rem;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #e2e8f0}
  .links a{color:#6366f1;text-decoration:none}
</style></head>
<body><div class="container">
<h1>${paper.title || "Untitled"}</h1>
<p class="authors">${(paper.authors || []).join(", ") || "Unknown authors"}</p>
<div class="tags">${(paper.categories || paper.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
${paper.aiSummary?.tldr ? `<div class="tldr"><h2>TL;DR</h2><p>${paper.aiSummary.tldr}</p></div>` : ""}
${paper.aiSummary?.motivation ? `<section><h2>Motivation</h2><p>${paper.aiSummary.motivation}</p></section>` : ""}
${paper.aiSummary?.method ? `<section><h2>Method</h2><p>${paper.aiSummary.method}</p></section>` : ""}
${paper.aiSummary?.result ? `<section><h2>Results</h2><p>${paper.aiSummary.result}</p></section>` : ""}
${paper.aiSummary?.conclusion ? `<section><h2>Conclusion</h2><p>${paper.aiSummary.conclusion}</p></section>` : ""}
${paper.abstract ? `<details class="abstract"><summary>Original Abstract</summary><p style="margin-top:.5rem;color:#475569;font-style:italic">${paper.abstract}</p></details>` : ""}
<div class="links">
  ${paper.url ? `<a href="${paper.url}" target="_blank">arXiv</a>` : ""}
  ${paper.pdfUrl ? `<a href="${paper.pdfUrl}" target="_blank">PDF</a>` : ""}
  ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank">DOI</a>` : ""}
</div>
</div></body></html>`;

const HTML_FALLBACK_EN = (paper) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${paper.title || "Paper Detail"}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;padding:2rem 1rem}
  .container{max-width:800px;margin:0 auto;background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:1.75rem;margin-bottom:.5rem;color:#0f172a}
  .authors{color:#64748b;margin-bottom:1rem}
  .tags{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}
  .tag{background:#eef2ff;color:#4f46e5;padding:.25rem .75rem;border-radius:999px;font-size:.875rem}
  .tldr{background:linear-gradient(135deg,#eef2ff,#f3e8ff);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;border-left:4px solid #6366f1}
  .tldr h2{font-size:1rem;color:#6366f1;margin-bottom:.5rem}
  section{margin-bottom:1.5rem}
  section h2{font-size:1.1rem;color:#334155;margin-bottom:.5rem}
  .abstract{border-top:1px solid #e2e8f0;padding-top:1rem;margin-top:1.5rem}
  .abstract summary{color:#6366f1;cursor:pointer;font-weight:600}
  .links{display:flex;gap:1rem;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #e2e8f0}
  .links a{color:#6366f1;text-decoration:none}
</style></head>
<body><div class="container">
<h1>${paper.title || "Untitled"}</h1>
<p class="authors">${(paper.authors || []).join(", ") || "Unknown authors"}</p>
<div class="tags">${(paper.categories || paper.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
${paper.aiSummary?.tldr ? `<div class="tldr"><h2>TL;DR</h2><p>${paper.aiSummary.tldr}</p></div>` : ""}
${paper.aiSummary?.motivation ? `<section><h2>Motivation</h2><p>${paper.aiSummary.motivation}</p></section>` : ""}
${paper.aiSummary?.method ? `<section><h2>Method</h2><p>${paper.aiSummary.method}</p></section>` : ""}
${paper.aiSummary?.result ? `<section><h2>Results</h2><p>${paper.aiSummary.result}</p></section>` : ""}
${paper.aiSummary?.conclusion ? `<section><h2>Conclusion</h2><p>${paper.aiSummary.conclusion}</p></section>` : ""}
${paper.abstract ? `<details class="abstract"><summary>Original Abstract</summary><p style="margin-top:.5rem;color:#475569;font-style:italic">${paper.abstract}</p></details>` : ""}
<div class="links">
  ${paper.url ? `<a href="${paper.url}" target="_blank">arXiv</a>` : ""}
  ${paper.pdfUrl ? `<a href="${paper.pdfUrl}" target="_blank">PDF</a>` : ""}
  ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank">DOI</a>` : ""}
</div>
</div></body></html>`;

/**
 * Generate a complete, AI-styled HTML page for a paper.
 * The AI synthesizes all paper information into a beautiful reading experience.
 *
 * @param {object} paper — paper document with fields: title, authors, abstract, aiSummary, url, pdfUrl, doi, categories, tags
 * @param {string} locale — "zh" | "en"
 * @returns {Promise<string>} — complete HTML document string
 */
export async function generatePaperHTML(paper, locale = "zh") {
  const systemPrompt = getHtmlPrompt(locale);
  const paperInfo = buildPaperInfoContent(paper);

  try {
    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildPaperHtmlUserPrompt(paperInfo, locale) },
      ],
      locale,
      { temperature: 0.3, maxTokens: 4096, timeoutMs: 45_000 }
    );

    const html = extractHTML(result.content);
    if (html) return html;
  } catch (err) {
    console.warn(`htmlRenderer: AI generation failed for "${paper.title?.slice(0, 80)}": ${err.message}`);
  }

  // Fallback: use a template-based HTML page (no AI needed)
  const fallback = locale === "zh" ? HTML_FALLBACK_ZH : HTML_FALLBACK_EN;
  return fallback(paper);
}

/**
 * Generate HTML for multiple papers as a daily digest page.
 * Absorbed from Daily-arXiv's to_md/convert.py pattern.
 *
 * @param {Array<object>} papers
 * @param {object} options — { locale, date }
 * @returns {Promise<string>} — complete HTML digest document
 */
export async function generateDigestHTML(papers, options = {}) {
  const { locale = "zh", date = new Date().toISOString().slice(0, 10) } = options;

  const systemPrompt = getDigestPrompt(locale);

  const papersText = papers.map((p, i) => {
    const s = p.aiSummary || {};
    return [
      `--- Paper ${i + 1} ---`,
      `Title: ${p.title}`,
      `Authors: ${(p.authors || []).join(", ")}`,
      `Categories: ${(p.categories || []).join(", ")}`,
      `TL;DR: ${s.tldr || p.abstract?.slice(0, 200) || "N/A"}`,
      `URL: ${p.url || ""}`,
    ].join("\n");
  }).join("\n\n");

  try {
    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildDigestUserPrompt(papersText, date) },
      ],
      locale,
      { temperature: 0.3, maxTokens: 8192, timeoutMs: 60_000 }
    );

    const html = extractHTML(result.content);
    if (html) return html;
  } catch (err) {
    console.warn(`htmlRenderer: digest generation failed: ${err.message}`);
  }

  // Fallback: simple digest page
  return buildFallbackDigest(papers, { locale, date });
}

function extractHTML(text) {
  // Check for complete HTML document
  if (/<!DOCTYPE html>/i.test(text) && /<\/html>/i.test(text)) {
    const start = text.indexOf("<!DOCTYPE");
    const end = text.lastIndexOf("</html>") + 7;
    if (start >= 0 && end > start) {
      return text.slice(start, end);
    }
  }
  // Check for HTML in code fence
  const fenceMatch = text.match(/```html\s*([\s\S]*?)```/);
  if (fenceMatch && /<!DOCTYPE html>/i.test(fenceMatch[1])) {
    return fenceMatch[1];
  }
  return null;
}

function buildFallbackDigest(papers, { locale, date }) {
  const isZh = locale === "zh";
  const title = isZh ? `每日论文摘要 — ${date}` : `Daily Paper Digest — ${date}`;

  const paperCards = papers.map((p, i) => {
    const s = p.aiSummary || {};
    return `
    <div class="paper-card">
      <span class="paper-num">${i + 1}</span>
      <div class="paper-content">
        <h3><a href="${p.url || "#"}" target="_blank">${p.title || "Untitled"}</a></h3>
        <p class="paper-authors">${(p.authors || []).join(", ") || ""}</p>
        <p class="paper-cats">${(p.categories || []).join(", ")}</p>
        ${s.tldr ? `<p class="paper-tldr"><strong>TL;DR:</strong> ${s.tldr}</p>` : ""}
      </div>
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="${isZh ? "zh-CN" : "en"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;padding:2rem 1rem}
  .container{max-width:900px;margin:0 auto}
  h1{font-size:1.75rem;margin-bottom:1.5rem;color:#0f172a}
  .paper-card{display:flex;gap:1rem;background:#fff;border-radius:8px;padding:1.25rem;margin-bottom:.75rem;box-shadow:0 1px 2px rgba(0,0,0,.05)}
  .paper-num{flex-shrink:0;width:2rem;height:2rem;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.875rem;font-weight:700}
  .paper-content{flex:1}
  .paper-content h3{font-size:1rem;margin-bottom:.25rem}
  .paper-content h3 a{color:#1e293b;text-decoration:none}
  .paper-content h3 a:hover{color:#6366f1}
  .paper-authors{color:#64748b;font-size:.875rem;margin-bottom:.125rem}
  .paper-cats{color:#94a3b8;font-size:.75rem;margin-bottom:.5rem}
  .paper-tldr{font-size:.875rem;color:#475569;border-left:3px solid #6366f1;padding-left:.75rem}
</style></head>
<body><div class="container">
<h1>${title}</h1>
<p style="color:#64748b;margin-bottom:1.5rem">${isZh ? `共 ${papers.length} 篇论文` : `Total: ${papers.length} papers`}</p>
${paperCards}
</div></body></html>`;
}

export { HTML_FALLBACK_ZH, HTML_FALLBACK_EN };
