import User from "../models/User.js";

const DEFAULT_QUOTA = 1000000; // 1M tokens/month per user
const APPROVAL_THRESHOLD = 50000; // single calls over 50k tokens need approval

export async function checkBudget(userId, estimatedTokens, UserModel = User) {
  if (!userId) {
    return { allowed: true, remaining: Infinity, requiresApproval: false, quota: Infinity, used: 0, estimatedTokens };
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    return { allowed: false, remaining: 0, requiresApproval: true, error: "User not found", quota: 0, used: 0, estimatedTokens };
  }

  const quota = user.quota || DEFAULT_QUOTA;
  const remaining = Math.max(0, quota - (user.quotaUsed || 0));
  const requiresApproval = estimatedTokens > APPROVAL_THRESHOLD || remaining < estimatedTokens;

  return {
    allowed: remaining >= estimatedTokens || user.role === "admin",
    remaining,
    quota,
    used: user.quotaUsed || 0,
    requiresApproval,
    estimatedTokens,
  };
}

export async function recordUsage(userId, tokensUsed, action, UserModel = User) {
  if (!userId || !tokensUsed) return;

  await UserModel.findByIdAndUpdate(userId, {
    $inc: { quotaUsed: tokensUsed },
  });

  return { userId, tokensUsed, action, recordedAt: new Date().toISOString() };
}

export async function getUsageStats(userId, UserModel = User) {
  const user = await UserModel.findById(userId);
  if (!user) return null;

  return {
    quota: user.quota || DEFAULT_QUOTA,
    used: user.quotaUsed || 0,
    remaining: Math.max(0, (user.quota || DEFAULT_QUOTA) - (user.quotaUsed || 0)),
    percentUsed: Math.round(((user.quotaUsed || 0) / (user.quota || DEFAULT_QUOTA)) * 100),
  };
}

export async function getAllUsageStats(UserModel = User) {
  const users = await UserModel.find();
  const totalQuota = users.reduce((s, u) => s + (u.quota || DEFAULT_QUOTA), 0);
  const totalUsed = users.reduce((s, u) => s + (u.quotaUsed || 0), 0);

  return {
    totalQuota,
    totalUsed,
    remaining: totalQuota - totalUsed,
    percentUsed: totalQuota > 0 ? Math.round((totalUsed / totalQuota) * 100) : 0,
    userCount: users.length,
  };
}

export default { checkBudget, recordUsage, getUsageStats, getAllUsageStats };
