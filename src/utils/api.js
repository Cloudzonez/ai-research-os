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

  async updateProfile(data) {
    return request("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async changePassword(currentPassword, newPassword) {
    return request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // ── Sessions (Chat History) ──────────────────
  async getSessions() {
    const data = await request("/sessions");
    return data.sessions || [];
  },

  async createSession(title) {
    const data = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return data.session;
  },

  async renameSession(id, title) {
    return request(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },

  async deleteSession(id) {
    return request(`/sessions/${id}`, { method: "DELETE" });
  },

  async toggleMarkSession(id) {
    return request(`/sessions/${id}/mark`, { method: "PATCH" });
  },

  async toggleShareSession(id) {
    return request(`/sessions/${id}/share`, { method: "PATCH" });
  },

  async getSessionMessages(id) {
    const data = await request(`/sessions/${id}/messages`);
    return data;
  },

  // ── Admin ────────────────────────────────────
  async adminGetUsers() {
    const data = await request("/admin/users");
    return data.users || [];
  },

  async adminGetUser(userId) {
    const data = await request(`/admin/users/${userId}`);
    return data.user || data;
  },

  async adminUpdateUser(userId, data_) {
    return request(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data_),
    });
  },

  async adminDeactivateUser(userId) {
    return request(`/admin/users/${userId}`, { method: "DELETE" });
  },

  async adminGetStats() {
    const data = await request("/admin/stats");
    return data.stats || data;
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
  async fetchPapers(params = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", params.page);
    if (params.limit) qs.set("limit", params.limit);
    if (params.sort) qs.set("sort", params.sort);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await request(`/papers${suffix}`);
    return { papers: data.papers || [], pagination: data.pagination };
  },

  async fetchPaper(paperId) {
    const data = await request(`/papers/${paperId}`);
    return data.paper || data;
  },

  async updatePaper(paperId, body) {
    const data = await request(`/papers/${paperId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return data.paper || data;
  },

  async deletePaper(paperId) {
    return request(`/papers/${paperId}`, { method: "DELETE" });
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

  async summarizePaper(paperId, locale = "zh") {
    const data = await request(`/papers/${paperId}/summarize`, {
      method: "POST",
      body: JSON.stringify({ locale }),
    });
    return data;
  },

  async getPaperHTML(paperId, locale = "zh") {
    const res = await fetch(apiUrl(`/papers/${paperId}/html?locale=${locale}`), {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (!res.ok) throw new Error(`HTML fetch failed: ${res.status}`);
    return res.text();
  },

  getPaperHTMLUrl(paperId, locale = "zh") {
    // Returns the URL for direct linking / iframe embedding
    return apiUrl(`/papers/${paperId}/html?locale=${locale}`);
  },

  async ingestPapers(query, sources, maxResults) {
    const data = await request("/papers/ingest", {
      method: "POST",
      body: JSON.stringify({ query, sources, maxResults }),
    });
    return data.papers || [];
  },

  // ── Trackers ────────────────────────────────
  async fetchTrackers(params = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", params.page);
    if (params.limit) qs.set("limit", params.limit);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await request(`/trackers${suffix}`);
    return { trackers: data.trackers || [], pagination: data.pagination };
  },

  async fetchTrackerDetail(trackerId) {
    return request(`/trackers/${trackerId}`);
  },

  async generateTracker(topic, locale) {
    return request("/trackers/generate", {
      method: "POST",
      body: JSON.stringify({ topic, locale: locale || "zh" }),
    });
  },

  async crawlTracker(trackerId, locale) {
    return request(`/trackers/${trackerId}/crawl`, {
      method: "POST",
      body: JSON.stringify({ locale: locale || "zh" }),
    });
  },

  async deleteTracker(trackerId) {
    return request(`/trackers/${trackerId}`, { method: "DELETE" });
  },

  // ── Writing ─────────────────────────────────
  async generateDraft(locale, topic) {
    const data = await request("/writing/generate", {
      method: "POST",
      body: JSON.stringify({ locale: locale || "zh", topic: topic || "" }),
    });
    return data.draft || "";
  },

  // ── Dashboards ──────────────────────────────
  async fetchDashboards() {
    const data = await request("/dashboards");
    return data.dashboards || [];
  },

  async fetchDashboard(id) {
    return request(`/dashboards/${id}`);
  },

  async createDashboard(name, description, jsonData, locale) {
    const data = await request("/dashboards", {
      method: "POST",
      body: JSON.stringify({ name, description, jsonData, locale: locale || "zh" }),
    });
    return data.dashboard;
  },

  async deleteDashboard(id) {
    return request(`/dashboards/${id}`, { method: "DELETE" });
  },

  // ── Dev Logs ─────────────────────────────────
  async fetchLogs(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, value);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const data = await request(`/logs${suffix}`);
    return data;
  },

  async fetchLogStats() {
    const data = await request("/logs/stats");
    return data.stats || data;
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
