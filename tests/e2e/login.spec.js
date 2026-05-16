import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

async function mockBackend(page) {
  await page.route(route("/auth/login"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "test-token", user: { id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 } }) }));
  await page.route(route("/auth/register"), async (r) => r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ token: "test-token", user: { id: "user-2", email: "new@university.edu", name: "New User", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 0 } }) }));
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  // Standard data endpoints after login
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers: [] }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", db: "connected", model: "x", uptime: 3600, nodeEnv: "test" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.clear());
});

test("teacher can log in with email and password", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /登录/ })).toBeVisible();
  await page.getByLabel("Email").fill("teacher@university.edu");
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
});

test("teacher can switch to register tab and see name field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /注册/ }).click();
  await expect(page.getByLabel("姓名")).toBeVisible();
  await page.getByLabel("姓名").fill("New User");
  await page.getByLabel("Email").fill("new@university.edu");
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: /创建账号/ }).click();
  await expect(page.getByText("New User")).toBeVisible({ timeout: 10000 });
});

test("teacher can switch between login and register tabs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /注册/ }).click();
  await expect(page.getByLabel("姓名")).toBeVisible();
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByLabel("姓名")).toBeHidden();
});
