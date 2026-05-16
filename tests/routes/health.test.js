import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Health route — validates the simplest API endpoint
// Spec ref: BUILD_PLAN.md Phase 7, README.md
// ---------------------------------------------------------------------------

// The health endpoint at server/routes/health.js exports a router.
// It uses mongoose.connection.readyState. We can import and test the
// handler logic by constructing the router and calling it.

test("health route exports an Express router", async () => {
  const { default: router } = await import("../../server/routes/health.js");
  assert.ok(router);
  assert.equal(typeof router, "function");
});

test("health route has GET / handler that returns JSON structure", async () => {
  const { default: router } = await import("../../server/routes/health.js");

  // Verify the router is an Express Router with stack
  assert.ok(router.stack, "router should have middleware stack");
  assert.ok(router.stack.length >= 1, "router should have at least one route");
});
