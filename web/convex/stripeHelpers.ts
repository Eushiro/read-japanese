import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ============================================
// INTERNAL QUERIES (for use by Stripe actions)
// ============================================

export const getSubscriptionByUserId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getSubscriptionByStripeCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
  },
});

// ============================================
// INTERNAL MUTATIONS (called by webhook handler)
// ============================================

export const handleSubscriptionCreated = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal("basic"), v.literal("pro"), v.literal("unlimited")),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status: "active",
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        renewalDate: args.currentPeriodEnd,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        tier: args.tier,
        status: "active",
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        startDate: now,
        renewalDate: args.currentPeriodEnd,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const handleSubscriptionUpdated = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    tier: v.union(v.literal("basic"), v.literal("pro"), v.literal("unlimited")),
    status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired")),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    // Find subscription by stripe ID
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const subscription = subscriptions.find(
      (s) => s.stripeSubscriptionId === args.stripeSubscriptionId
    );

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        tier: args.tier,
        status: args.status,
        renewalDate: args.currentPeriodEnd,
        updatedAt: Date.now(),
      });
    }
  },
});

export const handleSubscriptionCancelled = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find subscription by stripe ID
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const subscription = subscriptions.find(
      (s) => s.stripeSubscriptionId === args.stripeSubscriptionId
    );

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
