import Subscription from "../models/Subscription.js";
import Paper from "../models/Paper.js";
import User from "../models/User.js";
import { federatedSearch } from "./search/federationManager.js";
import { semanticScholarProvider } from "./ingestion/semanticScholar.js";

/**
 * Check all subscriptions and send alerts
 * @returns {Promise<Object>} Alert statistics
 */
export async function checkSubscriptions() {
  console.log("Checking subscriptions for new papers...");

  const now = new Date();
  const stats = {
    checked: 0,
    alerts: 0,
    errors: 0,
  };

  // Get subscriptions that need checking
  const subscriptions = await Subscription.find({
    enabled: true,
    $or: [
      { lastChecked: null },
      { lastChecked: { $lt: getCheckThreshold(now) } }
    ]
  }).populate("userId");

  for (const subscription of subscriptions) {
    try {
      stats.checked++;
      const newPapers = await checkSubscription(subscription);
      
      if (newPapers.length > 0) {
        await sendAlert(subscription, newPapers);
        stats.alerts++;
      }

      subscription.lastChecked = now;
      subscription.newPapersCount = newPapers.length;
      await subscription.save();
    } catch (error) {
      console.error(`Subscription check error (${subscription._id}):`, error);
      stats.errors++;
    }
  }

  console.log(`Subscription check complete:`, stats);
  return stats;
}

/**
 * Check a single subscription for new papers
 * @param {Object} subscription - Subscription document
 * @returns {Promise<Array>} New papers
 */
async function checkSubscription(subscription) {
  const since = subscription.lastChecked || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  switch (subscription.type) {
    case "author":
      return await checkAuthorSubscription(subscription, since);
    case "venue":
      return await checkVenueSubscription(subscription, since);
    case "keyword":
    case "topic":
      return await checkKeywordSubscription(subscription, since);
    default:
      return [];
  }
}

/**
 * Check for new papers by author
 */
async function checkAuthorSubscription(subscription, since) {
  if (!subscription.authorId) return [];

  try {
    // Search Semantic Scholar for author's recent papers
    const query = {
      searchQuery: `author:${subscription.authorName}`,
      filters: {
        yearFrom: since.getFullYear(),
      },
      maxResults: 50,
    };

    const results = await federatedSearch(query, {
      sources: ["semanticScholar", "openalex"],
    });

    // Filter to papers published after last check
    return results.papers.filter(p => 
      new Date(p.year, 0, 1) > since
    );
  } catch (error) {
    console.error("Author subscription check error:", error);
    return [];
  }
}

/**
 * Check for new papers in venue
 */
async function checkVenueSubscription(subscription, since) {
  if (!subscription.venueName) return [];

  try {
    const query = {
      searchQuery: subscription.venueName,
      filters: {
        yearFrom: since.getFullYear(),
        venue: subscription.venueName,
      },
      maxResults: 50,
    };

    const results = await federatedSearch(query, {
      sources: ["openalex", "semanticScholar"],
    });

    return results.papers.filter(p => 
      new Date(p.year, 0, 1) > since
    );
  } catch (error) {
    console.error("Venue subscription check error:", error);
    return [];
  }
}

/**
 * Check for new papers matching keywords
 */
async function checkKeywordSubscription(subscription, since) {
  if (!subscription.query && (!subscription.keywords || subscription.keywords.length === 0)) {
    return [];
  }

  try {
    const query = {
      searchQuery: subscription.query || subscription.keywords.join(" "),
      filters: {
        yearFrom: since.getFullYear(),
      },
      maxResults: 50,
    };

    const results = await federatedSearch(query, {
      sources: ["openalex", "arxiv", "semanticScholar"],
    });

    return results.papers.filter(p => 
      new Date(p.year, 0, 1) > since
    );
  } catch (error) {
    console.error("Keyword subscription check error:", error);
    return [];
  }
}

/**
 * Send alert to user
 * @param {Object} subscription - Subscription document
 * @param {Array} papers - New papers
 */
async function sendAlert(subscription, papers) {
  console.log(`Sending alert to user ${subscription.userId._id}: ${papers.length} new papers`);

  // TODO: Implement actual notification (email, push, etc.)
  // For now, just log
  
  subscription.lastNotified = new Date();
  await subscription.save();
}

/**
 * Get threshold date for checking based on frequency
 */
function getCheckThreshold(now) {
  const thresholds = {
    immediate: 60 * 60 * 1000, // 1 hour
    daily: 24 * 60 * 60 * 1000, // 1 day
    weekly: 7 * 24 * 60 * 60 * 1000, // 1 week
  };

  // Default to daily
  return new Date(now.getTime() - thresholds.daily);
}

/**
 * Create a new subscription
 * @param {string} userId - User ID
 * @param {Object} subscriptionData - Subscription data
 * @returns {Promise<Object>} Created subscription
 */
export async function createSubscription(userId, subscriptionData) {
  const subscription = await Subscription.create({
    userId,
    ...subscriptionData,
  });

  return subscription;
}

/**
 * Get user's subscriptions
 * @param {string} userId - User ID
 * @returns {Promise<Array>} User's subscriptions
 */
export async function getUserSubscriptions(userId) {
  return await Subscription.find({ userId }).sort({ createdAt: -1 });
}

/**
 * Delete subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (for authorization)
 */
export async function deleteSubscription(subscriptionId, userId) {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId,
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  await subscription.deleteOne();
}

export default {
  checkSubscriptions,
  createSubscription,
  getUserSubscriptions,
  deleteSubscription,
};

// Made with Bob
