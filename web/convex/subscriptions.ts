import { v } from "convex/values";

import tiersConfig from "../../shared/tiers.json";
import { internalMutation, mutation, query } from "./_generated/server";
import { isAdminEmail } from "./lib/admin";
import { subscriptionTierValidator } from "./schema";

// ============================================
// CREDIT LIMITS PER TIER
// ============================================
// Imported from shared/tiers.json for consistency across frontend/backend.
// See shared/tiers.json for pricing details.
//
export const TIER_CREDITS = Object.fromEntries(
  tiersConfig.tiers.map((t) => [t.id, t.credits])
) as Record<"free" | "plus" | "pro", number>;

// ============================================
// CREDIT COSTS PER ACTION
// ============================================
// Based on actual API costs (with margin):
// - Sentence generation: ~$0.0007 → 1 credit
// - AI verification: ~$0.001 → 1 credit
// - Comprehension grading: ~$0.001 → 1 credit
// - Audio (TTS): ~$0.002 → 2 credits
// - Shadowing session: ~$0.003 → 3 credits
//
export const CREDIT_COSTS = {
  sentence: 1, // generateFlashcard
  feedback: 1, // verifySentence (writing practice)
  comprehension: 1, // gradeComprehensionAnswer (story/video quiz)
  audio: 2, // generateFlashcardAudio
  shadowing: 3, // shadowing session (audio + scoring)
  question: 1, // comprehension/video question generation
  image: 3, // image generation
  story: 2, // personalized story generation
  placement: 2, // placement test question + optional TTS
  explain_question: 1, // AI explanation for practice question
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get current month and year
function getCurrentPeriod() {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // 1-12
    year: now.getFullYear(),
  };
}

// ============================================
// SUBSCRIPTION QUERIES
// ============================================

// Get user's current subscription
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Return free tier if no subscription exists
    if (!subscription) {
      return {
        tier: "free" as const,
        status: "active" as const,
        billingPeriod: undefined,
        credits: TIER_CREDITS.free,
      };
    }

    return {
      ...subscription,
      credits: TIER_CREDITS[subscription.tier as keyof typeof TIER_CREDITS] ?? TIER_CREDITS.free,
    };
  },
});

// ============================================
// CREDIT BALANCE QUERIES
// ============================================

// Get credit balance for the current month
export const getCreditBalance = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get subscription tier
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const tier = subscription?.tier ?? "free";
    const limit = TIER_CREDITS[tier as keyof typeof TIER_CREDITS] ?? TIER_CREDITS.free;

    // Get current period usage
    const { month, year } = getCurrentPeriod();
    const usage = await ctx.db
      .query("creditUsage")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const used = usage?.creditsUsed ?? 0;
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

    // Calculate reset date (first of next month)
    const resetDate = new Date(Date.UTC(year, month, 1)); // month from getCurrentPeriod is 1-indexed; Date.UTC month is 0-indexed, so this gives first of next month in UTC

    return {
      used,
      limit,
      remaining,
      percentage,
      nearLimit: percentage >= 80,
      tier,
      billingPeriod: subscription?.billingPeriod,
      resetDate: resetDate.toISOString(),
      // Alert dismissal status
      alertDismissed80: usage?.alertDismissed80 ?? false,
      alertDismissed95: usage?.alertDismissed95 ?? false,
    };
  },
});

// Get credit transactions for usage history
export const getCreditTransactions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const queryLimit = args.limit ?? 100;

    const transactions = await ctx.db
      .query("creditTransactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(queryLimit);

    return transactions;
  },
});

// ============================================
// CREDIT SPENDING MUTATIONS
// ============================================

// Spend credits for an action
export const spendCredits = mutation({
  args: {
    userId: v.string(),
    action: v.string(),
    count: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const actionKey = args.action as CreditAction;
    const cost = (CREDIT_COSTS[actionKey] ?? 1) * (args.count ?? 1);

    // Check if admin mode is enabled
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    const isAdmin = user?.isAdminMode && isAdminEmail(user.email);

    if (isAdmin) {
      // Admin bypass - log but don't deduct
      await ctx.db.insert("creditTransactions", {
        userId: args.userId,
        action: args.action,
        creditsSpent: 0, // Free for admin
        metadata: { ...args.metadata, adminBypass: true },
        createdAt: Date.now(),
      });
      return { success: true, creditsRemaining: Infinity, bypassed: true };
    }

    // Get current balance
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const tier = subscription?.tier ?? "free";
    const limit = TIER_CREDITS[tier as keyof typeof TIER_CREDITS] ?? TIER_CREDITS.free;

    const { month, year } = getCurrentPeriod();
    const usage = await ctx.db
      .query("creditUsage")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const currentUsed = usage?.creditsUsed ?? 0;
    const remaining = limit - currentUsed;

    // Check if enough credits
    if (remaining < cost) {
      throw new Error(
        `Insufficient credits. Need ${cost}, have ${remaining}. Upgrade your plan for more credits.`
      );
    }

    // Deduct credits
    if (usage) {
      await ctx.db.patch(usage._id, {
        creditsUsed: currentUsed + cost,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("creditUsage", {
        userId: args.userId,
        periodMonth: month,
        periodYear: year,
        creditsUsed: cost,
        updatedAt: Date.now(),
      });
    }

    // Log transaction
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      action: args.action,
      creditsSpent: cost,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    return {
      success: true,
      creditsRemaining: remaining - cost,
      bypassed: false,
    };
  },
});

// Internal mutation for logging transactions from actions
export const logCreditTransactionInternal = internalMutation({
  args: {
    userId: v.string(),
    action: v.string(),
    creditsSpent: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      action: args.action,
      creditsSpent: args.creditsSpent,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// ALERT DISMISSAL
// ============================================

// Dismiss credit alert (80% or 95%)
export const dismissCreditAlert = mutation({
  args: {
    userId: v.string(),
    threshold: v.union(v.literal(80), v.literal(95)),
  },
  handler: async (ctx, args) => {
    const { month, year } = getCurrentPeriod();

    const usage = await ctx.db
      .query("creditUsage")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const field = args.threshold === 80 ? "alertDismissed80" : "alertDismissed95";

    if (usage) {
      await ctx.db.patch(usage._id, {
        [field]: true,
        updatedAt: Date.now(),
      });
    } else {
      // Create usage record if it doesn't exist
      await ctx.db.insert("creditUsage", {
        userId: args.userId,
        periodMonth: month,
        periodYear: year,
        creditsUsed: 0,
        [field]: true,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================
// SUBSCRIPTION MUTATIONS
// ============================================

// Create or update subscription
export const upsert = mutation({
  args: {
    userId: v.string(),
    tier: subscriptionTierValidator,
    billingPeriod: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Calculate renewal date based on billing period
    const isAnnual = args.billingPeriod === "annual";
    const renewalMs = isAnnual ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: "active",
        billingPeriod: args.billingPeriod,
        renewalDate: now + renewalMs,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      tier: args.tier,
      status: "active",
      billingPeriod: args.billingPeriod,
      startDate: now,
      renewalDate: now + renewalMs,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Cancel subscription
export const cancel = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================
// ADMIN MODE
// ============================================

// Toggle admin mode (for admin emails only)
export const toggleAdminMode = mutation({
  args: {
    userId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Verify user is admin
    if (!isAdminEmail(user.email)) {
      throw new Error("Only admin users can enable admin mode");
    }

    await ctx.db.patch(user._id, {
      isAdminMode: args.enabled,
      updatedAt: Date.now(),
    });

    return { success: true, isAdminMode: args.enabled };
  },
});

// Reset credit usage for testing
export const resetUsage = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { month, year } = getCurrentPeriod();

    // Reset credit usage
    const creditUsage = await ctx.db
      .query("creditUsage")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    if (creditUsage) {
      await ctx.db.patch(creditUsage._id, {
        creditsUsed: 0,
        alertDismissed80: false,
        alertDismissed95: false,
        updatedAt: Date.now(),
      });
    }
  },
});
