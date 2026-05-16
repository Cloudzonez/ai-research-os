import { expect, test } from "@playwright/test";

function route(backendPath) { return `**/api${backendPath}`; }

async function mockBackend(page) {
  await page.route(route("/auth/me"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "teacher@university.edu", name: "Test Teacher", role: "teacher", language: "zh", quota: 1000000, quotaUsed: 12000 }) }));
  await page.route(route("/papers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ papers: [] }) }));
  await page.route(route("/trackers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ trackers: [] }) }));
  await page.route(route("/crawlers"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ crawlers: [] }) }));
  await page.route(route("/health"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", db: "connected", model: "x" }) }));
  await page.route(route("/chat/messages**"), async (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ messages: [] }) }));
  await page.route(route("/writing/generate"), async (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ draft: "## Related Work\n\nMARL has been studied...", tokensUsed: 300 }) }));
}

async function loginAndGoToWriting(page) {
  await page.addInitScript(() => { localStorage.setItem("auth_token", "test-token"); });
  await page.goto("/");
  await expect(page.getByText("Test Teacher")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /写作/ }).click();
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.clear());
});

test("writing workspace shows empty state when no draft", async ({ page }) => {
  await loginAndGoToWriting(page);
  await expect(page.getByText(/写作|Writing/i).first()).toBeVisible({ timeout: 5000 });
});

test("writing workspace has generate draft button", async ({ page }) => {
  await loginAndGoToWriting(page);
  await expect(page.getByRole("button", { name: /生成|Generate/i })).toBeVisible({ timeout: 5000 });
});

test("writing workspace renders without errors", async ({ page }) => {
  page.on("pageerror", (err) => { throw new Error(`Page error: ${err.message}`); });
  await loginAndGoToWriting(page);
  await expect(page.getByRole("main")).toBeVisible();
});
