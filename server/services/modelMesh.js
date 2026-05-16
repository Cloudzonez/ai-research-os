import { config } from "../config.js";

// Model tier definitions
const TIERS = {
  small: {
    models: ["deepseek-v4-pro"],
    maxTokens: 2048,
    costPer1K: 0.0001,
    suitableFor: ["classification", "extraction", "simple_summary", "tagging", "routing"],
  },
  reasoning: {
    models: ["deepseek-v4-pro"],
    maxTokens: 4096,
    costPer1K: 0.0005,
    suitableFor: ["complex_review", "method_comparison", "experiment_design", "grant_writing"],
  },
  long_context: {
    models: ["deepseek-v4-pro"],
    maxTokens: 8192,
    costPer1K: 0.001,
    suitableFor: ["full_paper", "long_proposal", "multi_round_review", "thesis_chapter"],
  },
  code: {
    models: ["deepseek-v4-pro"],
    maxTokens: 4096,
    costPer1K: 0.0005,
    suitableFor: ["script_generation", "data_analysis", "test_repair", "crawler_code"],
  },
};

export function routeModelCall(taskType, options = {}) {
  const { budget, preferredTier, dataSensitivity } = options;

  // Find the right tier for this task type
  let selectedTier = null;
  let selectedModel = null;

  for (const [tierName, tier] of Object.entries(TIERS)) {
    if (tier.suitableFor.includes(taskType)) {
      selectedTier = tierName;
      selectedModel = tier.models[0];
      break;
    }
  }

  // Fallback to small tier
  if (!selectedTier) {
    selectedTier = "small";
    selectedModel = TIERS.small.models[0];
  }

  // Override with preferred tier if specified and budget allows
  if (preferredTier && TIERS[preferredTier]) {
    const tier = TIERS[preferredTier];
    if (!budget || tier.costPer1K * (tier.maxTokens / 1000) <= budget) {
      selectedTier = preferredTier;
      selectedModel = tier.models[0];
    }
  }

  const tier = TIERS[selectedTier];

  return {
    model: selectedModel || config.model,
    tier: selectedTier,
    maxTokens: tier.maxTokens,
    estimatedCost: tier.costPer1K * (tier.maxTokens / 1000),
    costPer1K: tier.costPer1K,
  };
}

export function getAvailableTiers() {
  return Object.entries(TIERS).map(([name, tier]) => ({
    name,
    models: tier.models,
    maxTokens: tier.maxTokens,
    costPer1K: tier.costPer1K,
    suitableFor: tier.suitableFor,
  }));
}

export default { routeModelCall, getAvailableTiers };
