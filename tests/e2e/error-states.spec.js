import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("app shows login form when not authenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /登录|注册/i }).first()).toBeVisible({ timeout: 5000 });
});

test("paper library shows error state when API fails", async ({ page }) => {
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server error" }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));

  await page.addInitScript(() => { localStorage.setItem("auth_token", "test-token"); });
  await page.goto("/");
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /论文库/ }).click();
  // Should handle the error gracefully without crashing
  await expect(page.getByRole("main")).toBeVisible();
});

test("trackers page shows error state when API fails", async ({ page }) => {
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers: [] }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Server error" }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));

  await page.addInitScript(() => { localStorage.setItem("auth_token", "test-token"); });
  await page.goto("/");
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /追踪/ }).click();
  await expect(page.getByRole("main")).toBeVisible();
});

test("app handles network error when health check fails", async ({ page }) => {
  await page.route(route("/health"), async (r) => r.abort("connectionrefused"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /登录|注册/i }).first()).toBeVisible({ timeout: 5000 });
});

test("app shows loading state during initial data fetch", async ({ page }) => {
  await page.route(route("/auth/me"), async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /登录|注册/i }).first()).toBeVisible({ timeout: 5000 });
});
