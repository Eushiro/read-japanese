import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { subscriptionTierValidator } from "./schema";

// ============================================
// USAGE LIMITS PER TIER
// ============================================
// Scaling: Each tier gives ~4-5x value for 3x price
// This incentivizes upgrades while maintaining cost control
//
// Estimated API costs per action:
// - Sentence generation: ~$0.001
// - AI verification: ~$0.002
// - Audio (TTS): ~$0.002
// - Image generation: ~$0.02
// - Mock test generation: ~$0.05
// - Personalized story: ~$0.10
//
export const TIER_LIMITS = {
  free: {
    aiVerificationsPerMonth: 50,
    storiesPerMonth: 5,
    personalizedStoriesPerMonth: 0,
    mockTestsPerMonth: 0,
    flashcardsPerMonth: 100,
    audioPerMonth: 20,
  },
  basic: {
    // $5/mo - 4x free value
    aiVerificationsPerMonth: 200,
    storiesPerMonth: 20,
    personalizedStoriesPerMonth: 5,
    mockTestsPerMonth: 2,
    flashcardsPerMonth: 500,
    audioPerMonth: 100,
  },
  pro: {
    // $15/mo (3x basic) - 5x basic value
    aiVerificationsPerMonth: 1000,
    storiesPerMonth: 100,
    personalizedStoriesPerMonth: 25,
    mockTestsPerMonth: 15,
    flashcardsPerMonth: 3000,
    audioPerMonth: 500,
  },
  power: {
    // $45/mo (3x pro) - 5x pro value
    // Renamed from "unlimited" - no truly unlimited tier
    aiVerificationsPerMonth: 5000,
    storiesPerMonth: 500,
    personalizedStoriesPerMonth: 150,
    mockTestsPerMonth: 100,
    flashcardsPerMonth: 15000,
    audioPerMonth: 2500,
  },
} as const;

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
        limits: TIER_LIMITS.free,
      };
    }

    return {
      ...subscription,
      limits: TIER_LIMITS[subscription.tier],
    };
  },
});

// Get current usage for the month
export const getUsage = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    if (!usage) {
      return {
        aiVerifications: 0,
        storiesRead: 0,
        personalizedStoriesGenerated: 0,
        mockTestsGenerated: 0,
        flashcardsGenerated: 0,
        audioGenerated: 0,
      };
    }

    return {
      aiVerifications: usage.aiVerifications,
      storiesRead: usage.storiesRead,
      personalizedStoriesGenerated: usage.personalizedStoriesGenerated,
      mockTestsGenerated: usage.mockTestsGenerated,
      flashcardsGenerated: usage.flashcardsGenerated,
      audioGenerated: usage.audioGenerated,
    };
  },
});

// Check if user can perform an action
export const canPerformAction = query({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("aiVerification"),
      v.literal("readStory"),
      v.literal("generatePersonalizedStory"),
      v.literal("generateMockTest"),
      v.literal("generateFlashcard"),
      v.literal("generateAudio")
    ),
  },
  handler: async (ctx, args) => {
    // Get subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const tier = subscription?.tier ?? "free";
    const limits = TIER_LIMITS[tier];

    // Get current usage
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const actionToLimit: Record<string, { limitKey: keyof typeof limits; usageKey: string }> = {
      aiVerification: { limitKey: "aiVerificationsPerMonth", usageKey: "aiVerifications" },
      readStory: { limitKey: "storiesPerMonth", usageKey: "storiesRead" },
      generatePersonalizedStory: {
        limitKey: "personalizedStoriesPerMonth",
        usageKey: "personalizedStoriesGenerated",
      },
      generateMockTest: { limitKey: "mockTestsPerMonth", usageKey: "mockTestsGenerated" },
      generateFlashcard: { limitKey: "flashcardsPerMonth", usageKey: "flashcardsGenerated" },
      generateAudio: { limitKey: "audioPerMonth", usageKey: "audioGenerated" },
    };

    const { limitKey, usageKey } = actionToLimit[args.action];
    const limit = limits[limitKey];
    const currentUsage = usage ? ((usage as unknown as Record<string, number>)[usageKey] ?? 0) : 0;

    const remaining = limit - currentUsage;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      limit,
      used: currentUsage,
    };
  },
});

// ============================================
// SUBSCRIPTION MUTATIONS
// ============================================

// Create or update subscription (mocked - no real payment)
export const upsert = mutation({
  args: {
    userId: v.string(),
    tier: subscriptionTierValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: "active",
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      tier: args.tier,
      status: "active",
      startDate: now,
      renewalDate: now + 30 * 24 * 60 * 60 * 1000, // 30 days
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Cancel subscription (mocked)
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
// USAGE TRACKING MUTATIONS
// ============================================

// Increment usage counter
export const incrementUsage = mutation({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("aiVerification"),
      v.literal("readStory"),
      v.literal("generatePersonalizedStory"),
      v.literal("generateMockTest"),
      v.literal("generateFlashcard"),
      v.literal("generateAudio")
    ),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const increment = args.count ?? 1;

    const existing = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const actionToField: Record<string, string> = {
      aiVerification: "aiVerifications",
      readStory: "storiesRead",
      generatePersonalizedStory: "personalizedStoriesGenerated",
      generateMockTest: "mockTestsGenerated",
      generateFlashcard: "flashcardsGenerated",
      generateAudio: "audioGenerated",
    };

    const field = actionToField[args.action] as keyof typeof existing;

    if (existing) {
      await ctx.db.patch(existing._id, {
        [field]: ((existing as unknown as Record<string, number>)[field] ?? 0) + increment,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("usageRecords", {
        userId: args.userId,
        periodMonth: month,
        periodYear: year,
        aiVerifications: args.action === "aiVerification" ? increment : 0,
        storiesRead: args.action === "readStory" ? increment : 0,
        personalizedStoriesGenerated: args.action === "generatePersonalizedStory" ? increment : 0,
        mockTestsGenerated: args.action === "generateMockTest" ? increment : 0,
        flashcardsGenerated: args.action === "generateFlashcard" ? increment : 0,
        audioGenerated: args.action === "generateAudio" ? increment : 0,
        updatedAt: Date.now(),
      });
    }
  },
});

// Reset usage (for testing/admin)
export const resetUsage = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const existing = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiVerifications: 0,
        storiesRead: 0,
        personalizedStoriesGenerated: 0,
        mockTestsGenerated: 0,
        flashcardsGenerated: 0,
        audioGenerated: 0,
        updatedAt: Date.now(),
      });
    }
  },
});
