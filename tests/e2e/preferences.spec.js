import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

async function mockBackend(page) {
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers: [] }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", db: "connected", model: "x" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));
  await page.route(route("/mcp"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", result: { tools: [] }, id: null }) }));
}

async function login(page) {
  await page.addInitScript(() => { localStorage.setItem("auth_token", "test-token"); });
  await page.goto("/");
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.clear());
});

test("navigation sidebar shows all 6 workspace links", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("button", { name: /AI|中心/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /追踪/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /论文库|论文/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /写作/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /治理/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /工坊/ })).toBeVisible();
});

test("teacher can see their name and email in the header", async ({ page }) => {
  await login(page);
  await expect(page.getByText("teacher@university.edu")).toBeVisible();
});
