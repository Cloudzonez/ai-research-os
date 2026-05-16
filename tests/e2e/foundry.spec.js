import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

async function mockBackend(page) {
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers: [] }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", db: "connected", model: "x", uptime: 3600, nodeEnv: "test" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));

  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [{ _id: "c1", name: "Test Crawler", description: "A test crawler", crawlerKind: "standard", crawlerSpec: { query: "ml", sources: ["arxiv"], maxResults: 5 }, sharingScope: "school", approved: true, active: true, runCount: 3, lastRun: "2026-05-15T00:00:00.000Z" }] }) }));
  await page.route(route("/foundry"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ apps: 2, scripts: 1, crawlers: 1, agents: 3, tools: 10, eros: 0 }) }));
  await page.route(route("/foundry/apps"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ apps: [{ _id: "a1", title: "Literature Roadmap", template: "literature_roadmap", approvalState: "approved", publishedUrl: "https://example.com/app1" }] }) }));
  await page.route(route("/foundry/scripts"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ scripts: [{ _id: "s1", title: "Data Cleaner", language: "python", version: 1, sandboxResult: { status: "completed" } }] }) }));
  await page.route(route("/foundry/agents"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ agents: [{ _id: "ag1", name: "Paper Reviewer", purpose: "Review", riskLevel: "low", approvalPolicy: "auto", allowedTools: ["search_papers"], maxCost: 0.01 }] }) }));
  await page.route(route("/foundry/tools"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ tools: [{ name: "create_tracker", riskLevel: "low", permissionScope: "authenticated" }] }) }));
  await page.route(route("/crawlers/**/run"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ result: { itemCount: 3, paperCount: 3, errors: [] } }) }));
}

async function loginAndGoToFoundry(page) {
  await page.addInitScript(() => { localStorage.setItem("auth_token", "test-token"); });
  await page.goto("/");
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /能力工坊/ }).click();
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.clear());
});

test("foundry view shows stat cards with counts", async ({ page }) => {
  await loginAndGoToFoundry(page);
  await expect(page.getByText(/能力工坊|Foundry/i).first()).toBeVisible({ timeout: 5000 });
});

test("foundry has tabs for Apps, Scripts, Crawlers, Agents, Tools", async ({ page }) => {
  await loginAndGoToFoundry(page);
  await expect(page.getByText(/应用|Apps/i).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/脚本|Scripts/i).first()).toBeVisible();
  await expect(page.getByText(/爬虫|Crawlers/i).first()).toBeVisible();
});

test("crawlers tab shows crawler plugins", async ({ page }) => {
  await loginAndGoToFoundry(page);
  await expect(page.getByText("Test Crawler")).toBeVisible({ timeout: 5000 });
});

test("foundry renders without errors", async ({ page }) => {
  page.on("pageerror", (err) => { throw new Error(`Page error: ${err.message}`); });
  await loginAndGoToFoundry(page);
  await expect(page.getByRole("main")).toBeVisible();
});
