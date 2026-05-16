import test from "node:test";
import assert from "node:assert/strict";
import { getRiskLevel, requiresApproval } from "../server/middleware/approval.js";

// ---------------------------------------------------------------------------
// getRiskLevel + requiresApproval — risk classification for action governance
// Spec ref: BUILD_PLAN.md Phase 2 (low-risk auto, high-risk require approval)
// ---------------------------------------------------------------------------

test("getRiskLevel returns low for create_tracker", () => {
  assert.equal(getRiskLevel("create_tracker"), "low");
});

test("getRiskLevel returns low for upload_paper_pdf", () => {
  assert.equal(getRiskLevel("upload_paper_pdf"), "low");
});

test("getRiskLevel returns low for summarize_paper", () => {
  assert.equal(getRiskLevel("summarize_paper"), "low");
});

test("getRiskLevel returns low for draft_paper_section", () => {
  assert.equal(getRiskLevel("draft_paper_section"), "low");
});

test("getRiskLevel returns low for search_papers", () => {
  assert.equal(getRiskLevel("search_papers"), "low");
});

test("getRiskLevel returns low for navigate_to_workspace", () => {
  assert.equal(getRiskLevel("navigate_to_workspace"), "low");
});

test("getRiskLevel returns low for build_context_bundle", () => {
  assert.equal(getRiskLevel("build_context_bundle"), "low");
});

test("getRiskLevel returns medium for compare_papers", () => {
  assert.equal(getRiskLevel("compare_papers"), "medium");
});

test("getRiskLevel returns medium for generate_research_board", () => {
  assert.equal(getRiskLevel("generate_research_board"), "medium");
});

test("getRiskLevel returns medium for delete_paper", () => {
  assert.equal(getRiskLevel("delete_paper"), "medium");
});

test("getRiskLevel returns medium for delete_tracker", () => {
  assert.equal(getRiskLevel("delete_tracker"), "medium");
});

test("getRiskLevel returns high for generate_crawler_plugin", () => {
  assert.equal(getRiskLevel("generate_crawler_plugin"), "high");
});

test("getRiskLevel returns high for publish_app", () => {
  assert.equal(getRiskLevel("publish_app"), "high");
});

test("getRiskLevel returns high for share_broadly", () => {
  assert.equal(getRiskLevel("share_broadly"), "high");
});

test("getRiskLevel returns high for run_sandbox_code", () => {
  assert.equal(getRiskLevel("run_sandbox_code"), "high");
});

test("getRiskLevel returns high for expensive_model_call", () => {
  assert.equal(getRiskLevel("expensive_model_call"), "high");
});

test("getRiskLevel defaults to low for unknown action types", () => {
  assert.equal(getRiskLevel("nonexistent_action"), "low");
  assert.equal(getRiskLevel(""), "low");
  assert.equal(getRiskLevel("random_string_xyz"), "low");
});

test("requiresApproval returns true for high risk level", () => {
  assert.equal(requiresApproval("high"), true);
});

test("requiresApproval returns false for medium risk level", () => {
  assert.equal(requiresApproval("medium"), false);
});

test("requiresApproval returns false for low risk level", () => {
  assert.equal(requiresApproval("low"), false);
});

test("requiresApproval returns false for unknown risk level", () => {
  assert.equal(requiresApproval("critical"), false);
  assert.equal(requiresApproval(""), false);
});

test("all high-risk actions require approval", () => {
  const highRiskActions = ["generate_crawler_plugin", "publish_app", "share_broadly", "run_sandbox_code", "expensive_model_call"];
  for (const action of highRiskActions) {
    assert.equal(requiresApproval(getRiskLevel(action)), true, `${action} should require approval`);
  }
});

test("all low-risk actions do not require approval", () => {
  const lowRiskActions = [
    "create_tracker", "upload_paper_pdf", "summarize_paper",
    "draft_paper_section", "search_papers", "navigate_to_workspace",
    "build_context_bundle",
  ];
  for (const action of lowRiskActions) {
    assert.equal(requiresApproval(getRiskLevel(action)), false, `${action} should not require approval`);
  }
});
