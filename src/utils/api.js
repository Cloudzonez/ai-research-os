// Use relative URLs in dev (goes through Vite proxy),
// and same-origin in production (Express serves the built frontend).
const BACKEND_URL = "";

function getToken() {
  return localStorage.getItem("auth_token");
}

function apiUrl(path) {
  return `${BACKEND_URL}/api${path}`;
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ── Auth ────────────────────────────────────
  async register(email, password, name, role = "teacher") {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, role }),
    });
  },

  async login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getMe() {
    return request("/auth/me");
  },

  // ── Chat ────────────────────────────────────
  async submitMessage(text, locale) {
    const data = await request("/chat", {
      method: "POST",
      body: JSON.stringify({ text, locale: locale || "zh", sessionId: "default" }),
    });
    return {
      message: data.message,
      sideEffects: data.sideEffects || {},
    };
  },

  /**
   * Streaming chat — returns an object with { stream, abort }.
   * The stream is an async generator yielding { event, data } objects.
   * Events: step, token, done, error
   */
  submitMessageStream(text, locale, paperId) {
    const controller = new AbortController();
    const token = getToken();

    async function* stream() {
      const res = await fetch(apiUrl("/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, locale: locale || "zh", sessionId: "default", ...(paperId ? { paperId } : {}) }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Stream failed" }));
        throw new Error(err.error || `Stream error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                yield { event: eventType, data };
              } catch {
                // skip parse errors
              }
              eventType = "";
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      stream: stream(),
      abort: () => controller.abort(),
    };
  },

  async fetchInitialMessages() {
    const data = await request("/chat/messages?sessionId=default");
    return data.messages || [];
  },

  // ── Papers ──────────────────────────────────
  async fetchPapers() {
    const data = await request("/papers");
    return data.papers || [];
  },

  async fetchPaper(paperId) {
    const data = await request(`/papers/${paperId}`);
    return data.paper || data;
  },

  async uploadPapers(filesOrFilenames, locale) {
    const items = Array.from(filesOrFilenames || []);
    const first = items[0];
    const isFileUpload = typeof File !== "undefined" && first instanceof File;
    const body = isFileUpload
      ? {
          files: await Promise.all(items.map(async (file) => ({
            name: file.name,
            data: await fileToBase64(file),
          }))),
          locale: locale || "zh",
        }
      : { filenames: items, locale: locale || "zh" };

    const data = await request("/papers/upload", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.papers || [];
  },

  async analyzePaper(paperId) {
    const data = await request(`/papers/${paperId}/analyze`, { method: "POST" });
    return data;
  },

  async ingestPapers(query, sources, maxResults) {
    const data = await request("/papers/ingest", {
      method: "POST",
      body: JSON.stringify({ query, sources, maxResults }),
    });
    return data.papers || [];
  },

  // ── Trackers ────────────────────────────────
  async fetchTrackers() {
    const data = await request("/trackers");
    return data.trackers || [];
  },

  async fetchTrackerDetail(trackerId) {
    return request(`/trackers/${trackerId}`);
  },

  async generateTracker(topic, locale) {
    const data = await request("/trackers/generate", {
      method: "POST",
      body: JSON.stringify({ topic, locale: locale || "zh" }),
    });
    return data.tracker;
  },

  // ── Writing ─────────────────────────────────
  async generateDraft(locale, topic) {
    const data = await request("/writing/generate", {
      method: "POST",
      body: JSON.stringify({ locale: locale || "zh", topic: topic || "" }),
    });
    return data.draft || "";
  },

  // ── Crawlers ────────────────────────────────
  async getCrawlers() {
    const data = await request("/crawlers");
    return data.crawlers || [];
  },

  async generateCrawler(description, sources, locale) {
    const data = await request("/crawlers/generate", {
      method: "POST",
      body: JSON.stringify({ description, sources, locale: locale || "zh" }),
    });
    return data.crawler;
  },

  // ── Foundry ─────────────────────────────────
  async getFoundryApps() {
    const data = await request("/foundry/apps");
    return data.apps || [];
  },

  async generateFoundryApp(description, locale) {
    const data = await request("/foundry/apps/generate", {
      method: "POST",
      body: JSON.stringify({ description, locale: locale || "zh" }),
    });
    return data.app;
  },

  async getFoundryScripts() {
    const data = await request("/foundry/scripts");
    return data.scripts || [];
  },

  async generateFoundryScript(description, language, locale) {
    const data = await request("/foundry/scripts/generate", {
      method: "POST",
      body: JSON.stringify({ description, language, locale: locale || "zh" }),
    });
    return data.script;
  },

  async getFoundryStats() {
    const data = await request("/foundry");
    return data.stats || {};
  },

  // ── Health ──────────────────────────────────
  async healthCheck() {
    try {
      return await request("/health");
    } catch {
      return { status: "offline" };
    }
  },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export default api;
