import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

async function mockBackend(page, { papers = [] } = {}) {
  await page.route(route("/auth/login"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "test-token", user: { id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 } }) }));
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", db: "connected", model: "x", uptime: 3600, nodeEnv: "test" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));
}

async function loginViaUI(page) {
  await page.goto("/");
  // The page has both a tab button and submit button with "登录" text.
  // Use the submit button (btn-primary) to avoid strict mode violation.
  await expect(page.locator("button[type='submit']")).toBeVisible();
  await page.getByLabel("Email").fill("teacher@university.edu");
  await page.getByLabel("密码").fill("password123");
  await page.locator("button[type='submit']").click();
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("paper library shows empty state when no papers", async ({ page }) => {
  await mockBackend(page, { papers: [] });
  await loginViaUI(page);
  await page.getByRole("button", { name: /论文库/ }).click();
  await expect(page.getByText(/暂无|没有|No papers/i)).toBeVisible({ timeout: 5000 });
});

test("paper library shows list of papers", async ({ page }) => {
  await mockBackend(page, { papers: [
    { _id: "p1", title: "Multi-Agent Reinforcement Learning", source: "arxiv", area: "AI", score: 85, sharing: "school", tags: ["arXiv"], doi: "10.1/test", abstract: "Studies MARL.", authors: ["A. Teacher"], year: 2025, status: "summarized", summary: "Novel." },
    { _id: "p2", title: "Graph Neural Networks", source: "openalex", area: "ML", score: 78, sharing: "school", tags: ["OpenAlex"], doi: "10.2/test", abstract: "GNN survey.", authors: ["B. Researcher"], year: 2024, status: "parsed" },
  ]});
  await loginViaUI(page);
  await page.getByRole("button", { name: /论文库/ }).click();
  await expect(page.getByText("Multi-Agent Reinforcement Learning")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Graph Neural Networks")).toBeVisible();
});

test("paper library has upload area", async ({ page }) => {
  await mockBackend(page, { papers: [] });
  await loginViaUI(page);
  await page.getByRole("button", { name: /论文库/ }).click();
  await expect(page.getByText(/上传|Upload/i).first()).toBeVisible({ timeout: 5000 });
});
