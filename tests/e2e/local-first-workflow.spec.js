import { expect, test } from "@playwright/test";

const backend = "http://localhost:3001/api";

async function mockBackend(page) {
  await page.route(`${backend}/auth/register`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        token: "test-token",
        user: {
          id: "user-1",
          email: "teacher@university.edu",
          name: "Test Teacher",
          role: "teacher",
          language: "zh",
          quota: 1000000,
          quotaUsed: 12000,
        },
      }),
    });
  });

  await page.route(`${backend}/papers`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ papers: [] }),
    });
  });

  await page.route(`${backend}/trackers`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ trackers: [] }),
    });
  });

  await page.route(`${backend}/crawlers`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ crawlers: [] }),
    });
  });

  await page.route(`${backend}/health`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", database: "mock" }),
    });
  });

  await page.route(`${backend}/chat/messages?sessionId=default`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ messages: [] }),
    });
  });

  await page.route(`${backend}/chat/stream`, async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: [
        "event: step",
        'data: {"step":"context_building","message":"正在构建任务上下文..."}',
        "",
        "event: token",
        'data: {"token":"已创建多智能体教育追踪器。"}',
        "",
        "event: done",
        'data: {"kind":"tracker","tokensUsed":42,"contextBundle":{"tokens":42,"artifacts":0,"allowedPercent":100,"papers":[]},"sideEffects":{"tracker":{"id":"tracker-1","name":"多智能体强化学习教育追踪","cadence":"Daily","papers":0,"sources":["arXiv","OpenAlex"],"signals":["高相关","新论文"],"keywords":["multi-agent","education"],"subscribers":1,"lastRun":"2026-05-14T00:00:00.000Z"}}}',
        "",
        "",
      ].join("\n"),
    });
  });

  await page.route(`${backend}/trackers/**`, async (route) => {
    if (route.request().method() === "POST" && route.request().url().endsWith("/trackers/tracker-1/crawl")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          tracker: {
            id: "tracker-1",
            name: "多智能体强化学习教育追踪",
            cadence: "Daily",
            papers: 2,
            sources: ["arXiv", "OpenAlex"],
            signals: ["高相关", "新论文"],
            keywords: ["multi-agent", "education"],
            subscribers: 1,
            lastRun: "2026-05-14T00:00:00.000Z",
            crawlStatus: "completed",
          },
          crawl: { paperCount: 2, errors: [] },
          papers: [],
        }),
      });
      return;
    }

    if (route.request().method() !== "DELETE") return route.fallback();
    const ok = route.request().url().endsWith("/trackers/tracker-1");
    await route.fulfill({
      status: ok ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(ok ? { ok: true } : { error: "Tracker not found" }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.clear());
});

test("teacher can register, run an AI workflow, and see the created tracker", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");

  await page.getByRole("button", { name: /注册/ }).click();
  await page.getByLabel("姓名").fill("Test Teacher");
  await page.getByLabel("Email").fill("teacher@university.edu");
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: "创建账号" }).click();

  await expect(page.getByText("Test Teacher")).toBeVisible();
  await expect(page.getByRole("main").getByText("AI 中心")).toBeVisible();

  await page.getByRole("button", { name: "创建追踪器" }).click();
  await expect(page.getByPlaceholder(/帮我追踪/)).toHaveValue(/追踪/);

  await page.getByRole("button", { name: "提交研究需求" }).click();

  await expect(page.getByText("已创建多智能体教育追踪器。")).toBeVisible();
  await expect(page.getByText("追踪器已创建")).toBeVisible();

  await page.getByRole("button", { name: "论文追踪" }).click();
  await expect(page.getByText("多智能体强化学习教育追踪")).toBeVisible();
  await expect(page.getByText("multi-agent")).toBeVisible();

  await page.getByText("多智能体强化学习教育追踪").hover();
  await page.getByTitle("运行抓取").click();
  await expect(page.getByText("已完成")).toBeVisible();
  await expect(page.getByText("抓取完成：2 篇论文")).toBeVisible();

  await page.getByText("多智能体强化学习教育追踪").hover();
  await page.getByTitle("删除").click();
  await expect(page.getByText("多智能体强化学习教育追踪")).toBeHidden();
});
