import AIAction from "../models/AIAction.js";

const RISK_LEVELS = {
  create_tracker: "low",
  upload_paper_pdf: "low",
  summarize_paper: "low",
  draft_paper_section: "low",
  search_papers: "low",
  navigate_to_workspace: "low",
  compare_papers: "medium",
  generate_research_board: "medium",
  build_context_bundle: "low",
  generate_crawler_plugin: "high",
  delete_paper: "medium",
  delete_tracker: "medium",
  publish_app: "high",
  share_broadly: "high",
  run_sandbox_code: "high",
  expensive_model_call: "high",
};

export function getRiskLevel(action) {
  return RISK_LEVELS[action] || "low";
}

export function requiresApproval(riskLevel) {
  return riskLevel === "high";
}

export async function createApproval(actionData) {
  const riskLevel = getRiskLevel(actionData.action);
  const approvalState = requiresApproval(riskLevel) ? "pending" : "auto_approved";

  return AIAction.create({
    ...actionData,
    riskLevel,
    approvalState,
  });
}

export async function approveAction(actionId, adminUserId) {
  return AIAction.findByIdAndUpdate(
    actionId,
    { approvalState: "approved", approvedBy: adminUserId },
    { new: true }
  );
}

export async function denyAction(actionId, adminUserId) {
  return AIAction.findByIdAndUpdate(
    actionId,
    { approvalState: "denied", approvedBy: adminUserId },
    { new: true }
  );
}
