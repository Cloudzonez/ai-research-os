import test from "node:test";
import assert from "node:assert/strict";
import { createLogger, getLogStats, queryLogs } from "../server/services/logger.js";

test("logger stores searchable logs in memory when MongoDB is disconnected", async () => {
  const namespace = `test-${Date.now()}`;
  const logger = createLogger(namespace);

  logger.info("logger memory fallback works", {
    event: "logger_memory_test",
    requestId: "req-test-1",
    path: "/api/test",
    statusCode: 200,
    durationMs: 12,
  }, { mirrorConsole: false });

  const result = await queryLogs({ namespace, q: "memory fallback", limit: 10 });
  assert.equal(result.storage, "memory");
  assert.ok(result.logs.length >= 1);
  assert.equal(result.logs[0].namespace, namespace);
  assert.equal(result.logs[0].event, "logger_memory_test");

  const stats = await getLogStats();
  assert.ok(stats.memoryCount >= 1);
});
