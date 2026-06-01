import { config } from "../config.js";

// ─── NotebookLM Enterprise API Client ────────────────────────────────────────
//
// All operations are ATOMIC: Google Cloud is always called FIRST.
// Only on success do we return the data needed to persist locally.
// If Google fails → the caller aborts local persistence → error shown to user.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the Google Cloud NotebookLM project API base URL dynamically.
 */
function getBaseUrl() {
  return `https://notebooklm.googleapis.com/v1/projects/${config.notebooklmProjectId}/locations/global`;
}

/**
 * Build the Authorization header using the configured API key.
 */
function authHeaders() {
  if (!config.notebooklmApiKey) {
    throw new Error(
      "NotebookLM API key is not configured. Please set NOTEBOOKLM_API_KEY in your .env file."
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.notebooklmApiKey}`,
    "X-Goog-User-Project": config.notebooklmProjectId,
  };
}

/**
 * Create a new NotebookLM workspace on Google Cloud.
 * MUST be called before creating a local Notebook record.
 *
 * @param {string} title
 * @returns {Promise<{ workspaceId: string, displayName: string }>}
 */
export async function createWorkspace(title) {
  if (!config.notebooklmEnabled) {
    throw new Error("NotebookLM API is disabled. Set NOTEBOOKLM_API_ENABLED=true in .env.");
  }

  const res = await fetch(`${getBaseUrl()}/notebooks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ displayName: title }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google NotebookLM API error (createWorkspace): ${res.status} ${err}`);
  }

  const data = await res.json();
  // Google returns: { name: "projects/.../notebooks/WORKSPACE_ID", displayName: "..." }
  const workspaceId = data.name?.split("/").pop();
  if (!workspaceId) throw new Error("Google API returned no workspace ID.");

  return { workspaceId, displayName: data.displayName || title };
}

/**
 * Upload a source document (text content) to a Google Cloud NotebookLM workspace.
 * MUST succeed before saving source locally.
 *
 * @param {string} workspaceId - Google Cloud workspace ID
 * @param {object} source - { title, textContent }
 * @returns {Promise<{ googleSourceId: string }>}
 */
export async function uploadSource(workspaceId, source) {
  if (!config.notebooklmEnabled) {
    throw new Error("NotebookLM API is disabled.");
  }

  const res = await fetch(`${getBaseUrl()}/notebooks/${workspaceId}/sources`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      displayName: source.title,
      content: { textContent: source.textContent },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google NotebookLM API error (uploadSource): ${res.status} ${err}`);
  }

  const data = await res.json();
  const googleSourceId = data.name?.split("/").pop();
  if (!googleSourceId) throw new Error("Google API returned no source ID.");

  return { googleSourceId };
}

/**
 * Delete a source from a Google Cloud NotebookLM workspace.
 *
 * @param {string} workspaceId
 * @param {string} googleSourceId
 */
export async function deleteSource(workspaceId, googleSourceId) {
  if (!config.notebooklmEnabled) return;

  const res = await fetch(
    `${getBaseUrl()}/notebooks/${workspaceId}/sources/${googleSourceId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google NotebookLM API error (deleteSource): ${res.status} ${err}`);
  }
}

/**
 * Send a chat message to a Google Cloud NotebookLM workspace and get a grounded response.
 *
 * @param {string} workspaceId
 * @param {string} query
 * @param {Array}  history - [{ role: "user"|"assistant", content: string }]
 * @returns {Promise<{ text: string, citations: Array }>}
 */
export async function chatWithSources(workspaceId, query, history = []) {
  if (!config.notebooklmEnabled) {
    throw new Error("NotebookLM API is disabled.");
  }

  const messages = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  messages.push({ role: "user", parts: [{ text: query }] });

  const res = await fetch(`${getBaseUrl()}/notebooks/${workspaceId}:generateGroundedContent`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ contents: messages }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google NotebookLM API error (chat): ${res.status} ${err}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";
  const citations = candidate?.groundingMetadata?.groundingChunks || [];

  return { text, citations };
}

/**
 * Generate a Studio artifact for a given notebook workspace.
 * Uses DeepSeek as a fallback for artifact types not supported natively by the API.
 *
 * @param {string} workspaceId
 * @param {string} type - One of: audio_overview, slide_deck, video_overview, mind_map,
 *                         report, flashcards, quiz, infographic, data_table
 * @param {Array}  sources - Array of source objects (title + textContent) for context
 * @param {Function} chatFn - DeepSeek fallback chat function
 * @returns {Promise<{ content: object|string }>}
 */
export async function generateArtifact(workspaceId, type, sources, chatFn) {
  if (!config.notebooklmEnabled) {
    throw new Error("NotebookLM API is disabled.");
  }

  // Build a combined context from all sources for fallback generation
  const combinedContext = sources
    .map((s) => `## ${s.title}\n${s.textContent || s.abstract || ""}`)
    .join("\n\n")
    .slice(0, 12000);

  const PROMPTS = {
    audio_overview: `You are creating a podcast script based on the following research sources. Write a natural, engaging 2-host (Host A and Host B) conversation that covers the key themes, findings, and insights. Format as:\nHost A: ...\nHost B: ...\n\nSources:\n${combinedContext}`,
    slide_deck: `Create a structured slide deck outline from these research sources. Return JSON: {"slides":[{"title":"...","bullets":["..."],"speakerNotes":"..."}]}. Sources:\n${combinedContext}`,
    video_overview: `Write a narrated video script with scene descriptions from these sources. Format:\n[SCENE: description]\nNarrator: ...\n\nSources:\n${combinedContext}`,
    mind_map: `Create a mind map structure from these sources. Return JSON: {"central":"Main Topic","branches":[{"label":"...","children":["..."]}]}. Sources:\n${combinedContext}`,
    report: `Write a comprehensive executive briefing report from these research sources with sections: Executive Summary, Key Findings, Methodology Overview, Implications, and Conclusion.\n\nSources:\n${combinedContext}`,
    flashcards: `Create 10 study flashcards from these sources. Return JSON: {"flashcards":[{"front":"Question...","back":"Answer..."}]}. Sources:\n${combinedContext}`,
    quiz: `Create a 10-question multiple-choice quiz from these sources. Return JSON: {"questions":[{"question":"...","options":["A)...","B)...","C)...","D)..."],"answer":"A","explanation":"..."}]}. Sources:\n${combinedContext}`,
    infographic: `Create an infographic text layout from these sources. Return JSON: {"title":"...","stats":[{"label":"...","value":"..."}],"keyPoints":["..."],"conclusion":"..."}. Sources:\n${combinedContext}`,
    data_table: `Extract key data, metrics, and findings from these sources into a table. Return JSON: {"headers":["..."],"rows":[["..."]],"caption":"..."}. Sources:\n${combinedContext}`,
  };

  const prompt = PROMPTS[type];
  if (!prompt) throw new Error(`Unknown artifact type: ${type}`);

  // Use DeepSeek for artifact generation (content-based tasks)
  const result = await chatFn([{ role: "user", content: prompt }], "en", {
    maxTokens: 3000,
    temperature: 0.7,
  });

  const rawContent = result.content || "";

  // For JSON-based artifacts, parse the JSON
  const jsonTypes = ["slide_deck", "mind_map", "flashcards", "quiz", "infographic", "data_table"];
  if (jsonTypes.includes(type)) {
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) return { content: JSON.parse(jsonMatch[0]) };
    } catch {
      // Fall through — return as raw text
    }
  }

  return { content: rawContent };
}

/**
 * Delete a Google Cloud NotebookLM workspace entirely.
 *
 * @param {string} workspaceId
 */
export async function deleteWorkspace(workspaceId) {
  if (!config.notebooklmEnabled) return;

  const res = await fetch(`${getBaseUrl()}/notebooks/${workspaceId}`, {
    method: "DELETE",
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google NotebookLM API error (deleteWorkspace): ${res.status} ${err}`);
  }
}
