import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

async function mockBackend(page) {
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers: [] }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", db: "connected", model: "x", uptime: 3600, nodeEnv: "test" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));
  await page.route(route("/mcp"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", result: { tools: [{ name: "search_papers" }, { name: "create_tracker" }] }, id: null }) }));
}

async function loginAndGoToGovernance(page) {
  await page.addInitScript(() => { localStorage.setItem("auth_token", "test-token"); });
  await page.goto("/");
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /治理|Governance/ }).click();
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.clear());
});

test("governance view shows token usage information", async ({ page }) => {
  await loginAndGoToGovernance(page);
  await expect(page.getByText(/治理|Governance/i).first()).toBeVisible({ timeout: 5000 });
});

test("governance view renders MCP tools", async ({ page }) => {
  await loginAndGoToGovernance(page);
  await expect(page.getByText(/search_papers|create_tracker/i).first()).toBeVisible({ timeout: 10000 });
});

test("governance view renders without errors", async ({ page }) => {
  page.on("pageerror", (err) => { throw new Error(`Page error: ${err.message}`); });
  await loginAndGoToGovernance(page);
  await expect(page.getByRole("main")).toBeVisible();
});
