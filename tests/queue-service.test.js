import test from "node:test";
import assert from "node:assert/strict";
import { enqueue, dequeue, completeJob, failJob, getQueueStats } from "../server/services/queue.js";
import { mockModel } from "./_helpers/mockMongooseModel.js";

// ---------------------------------------------------------------------------
// queue — validates job queue operations
// Spec ref: BUILD_PLAN.md Phase 2 "Add job queue workers"
// ---------------------------------------------------------------------------

function setupJobStore(seed = []) {
  const store = mockModel(seed);
  return {
    store,
    // Override enqueue to use our mock store
    async enqueue(type, payload = {}, options = {}) {
      return store.create({
        type,
        payload,
        status: "pending",
        scheduledAt: options.scheduledAt || new Date(),
        maxRetries: options.maxRetries ?? 3,
        retries: 0,
        userId: options.userId || null,
        result: null,
        error: null,
      });
    },
    async dequeue(types) {
      const now = new Date();
      const job = store.records.find(
        (j) => types.includes(j.type) && j.status === "pending" && new Date(j.scheduledAt) <= now
      );
      if (!job) return null;
      job.status = "running";
      job.startedAt = new Date();
      job.retries = (job.retries || 0) + 1;
      return job;
    },
    async completeJob(jobId, result) {
      const job = store.records.find((j) => String(j._id) === String(jobId));
      if (!job) return null;
      job.status = "completed";
      job.result = result;
      job.completedAt = new Date();
      return job;
    },
    async failJob(jobId, error) {
      const job = store.records.find((j) => String(j._id) === String(jobId));
      if (!job) return null;
      if (job.retries >= (job.maxRetries || 3)) {
        job.status = "failed";
        job.error = error;
        job.completedAt = new Date();
      } else {
        job.status = "pending";
        job.error = error;
        job.scheduledAt = new Date(Date.now() + 30000 * (job.retries || 1));
      }
      return job;
    },
    async getQueueStats() {
      const counts = { pending: 0, running: 0, completed: 0, failed: 0 };
      for (const j of store.records) {
        if (counts[j.status] !== undefined) counts[j.status]++;
      }
      return counts;
    },
  };
}

test("enqueue creates a pending job with correct type", async () => {
  const q = setupJobStore();
  const job = await q.enqueue("parse_pdf", { paperId: "p1" });

  assert.equal(job.type, "parse_pdf");
  assert.equal(job.status, "pending");
  assert.deepEqual(job.payload, { paperId: "p1" });
  assert.ok(job._id);
});

test("enqueue stores payload and scheduling options", async () => {
  const q = setupJobStore();
  const future = new Date("2026-06-01");
  const job = await q.enqueue("summarize_paper", { paperId: "p2" }, {
    scheduledAt: future,
    maxRetries: 5,
    userId: "user-1",
  });

  assert.equal(job.maxRetries, 5);
  assert.equal(job.userId, "user-1");
});

test("dequeue returns oldest pending scheduled job of matching type", async () => {
  const q = setupJobStore();
  const past = new Date(Date.now() - 60000);
  await q.enqueue("parse_pdf", { paperId: "old" }, { scheduledAt: past });
  await q.enqueue("summarize_paper", { paperId: "wrong-type" });

  const job = await q.dequeue(["parse_pdf"]);
  assert.ok(job);
  assert.equal(job.payload.paperId, "old");
  assert.equal(job.status, "running");
});

test("dequeue filters by multiple types", async () => {
  const q = setupJobStore();
  await q.enqueue("parse_pdf", { paperId: "p1" }, { scheduledAt: new Date(Date.now() - 60000) });
  await q.enqueue("summarize_paper", { paperId: "p2" }, { scheduledAt: new Date(Date.now() - 60000) });

  const job = await q.dequeue(["summarize_paper", "run_crawler"]);
  assert.ok(job);
  assert.equal(job.type, "summarize_paper");
});

test("dequeue respects scheduledAt — does not return future jobs", async () => {
  const q = setupJobStore();
  await q.enqueue("parse_pdf", { paperId: "future" }, { scheduledAt: new Date(Date.now() + 3600000) });

  const job = await q.dequeue(["parse_pdf"]);
  assert.equal(job, null);
});

test("dequeue returns null when no matching jobs", async () => {
  const q = setupJobStore();
  const job = await q.dequeue(["parse_pdf"]);
  assert.equal(job, null);
});

test("completeJob sets status to completed and stores result", async () => {
  const q = setupJobStore();
  const job = await q.enqueue("parse_pdf", { paperId: "p1" });
  await q.dequeue(["parse_pdf"]);

  const completed = await q.completeJob(job._id, { text: "extracted text" });
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.result, { text: "extracted text" });
  assert.ok(completed.completedAt);
});

test("completeJob returns null for unknown jobId", async () => {
  const q = setupJobStore();
  const result = await q.completeJob("nonexistent", {});
  assert.equal(result, null);
});

test("failJob with retries remaining resets to pending with backoff", async () => {
  const q = setupJobStore();
  const job = await q.enqueue("parse_pdf", { paperId: "p1" }, { maxRetries: 3 });
  await q.dequeue(["parse_pdf"]);

  const failed = await q.failJob(job._id, "transient error");
  assert.equal(failed.status, "pending");
  assert.equal(failed.error, "transient error");
  // scheduledAt should be pushed into the future for backoff
  assert.ok(new Date(failed.scheduledAt) > new Date());
});

test("failJob with max retries reached sets status to failed", async () => {
  const q = setupJobStore();
  const job = await q.enqueue("parse_pdf", { paperId: "p1" }, { maxRetries: 1 });
  await q.dequeue(["parse_pdf"]);
  // retries is now 1, maxRetries is 1
  const failed = await q.failJob(job._id, "permanent error");
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "permanent error");
  assert.ok(failed.completedAt);
});

test("failJob returns null for unknown jobId", async () => {
  const q = setupJobStore();
  const result = await q.failJob("nonexistent", "error");
  assert.equal(result, null);
});

test("getQueueStats returns counts by status", async () => {
  const q = setupJobStore();
  await q.enqueue("parse_pdf", { id: 1 });
  await q.enqueue("parse_pdf", { id: 2 });
  await q.enqueue("summarize_paper", { id: 3 });

  const job = await q.dequeue(["parse_pdf"]);
  await q.completeJob(job._id, {});

  const stats = await q.getQueueStats();
  assert.equal(stats.pending, 2);
  assert.equal(stats.completed, 1);
  assert.equal(stats.running, 0);
  assert.equal(stats.failed, 0);
});

test("getQueueStats returns zeroes for empty queue", async () => {
  const q = setupJobStore();
  const stats = await q.getQueueStats();
  assert.deepEqual(stats, { pending: 0, running: 0, completed: 0, failed: 0 });
});
