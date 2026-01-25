import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

// Cost per 1M tokens in cents (as of Jan 2025)
// Duplicated here to avoid "use node" dependency
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 10, output: 40 },
  "google/gemini-2.0-flash": { input: 10, output: 40 },
  "anthropic/claude-haiku-4.5": { input: 80, output: 400 },
  "anthropic/claude-3-haiku": { input: 25, output: 125 },
};

function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || { input: 100, output: 400 };
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

/**
 * Log an AI API call for cost tracking
 */
export const log = internalMutation({
  args: {
    userId: v.optional(v.string()),
    action: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    latencyMs: v.optional(v.number()),
    success: v.boolean(),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const estimatedCostCents = calculateCostCents(args.model, args.inputTokens, args.outputTokens);

    await ctx.db.insert("aiUsage", {
      userId: args.userId,
      action: args.action,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      estimatedCostCents,
      latencyMs: args.latencyMs,
      success: args.success,
      error: args.error,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

/**
 * Helper to log usage from an AICallResult
 */
export const logFromResult = internalMutation({
  args: {
    userId: v.optional(v.string()),
    action: v.string(),
    result: v.object({
      content: v.string(),
      usage: v.optional(
        v.object({
          prompt_tokens: v.number(),
          completion_tokens: v.number(),
          total_tokens: v.number(),
        })
      ),
      model: v.string(),
      latencyMs: v.number(),
    }),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { result, userId, action, metadata } = args;
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    const estimatedCostCents = calculateCostCents(
      result.model,
      usage.prompt_tokens,
      usage.completion_tokens
    );

    await ctx.db.insert("aiUsage", {
      userId,
      action,
      model: result.model,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCostCents,
      latencyMs: result.latencyMs,
      success: true,
      metadata,
      createdAt: Date.now(),
    });
  },
});

/**
 * Log a failed AI call
 */
export const logError = internalMutation({
  args: {
    userId: v.optional(v.string()),
    action: v.string(),
    model: v.string(),
    error: v.string(),
    latencyMs: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", {
      userId: args.userId,
      action: args.action,
      model: args.model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostCents: 0,
      latencyMs: args.latencyMs,
      success: false,
      error: args.error,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get AI usage stats (admin only)
 */
export const getStats = query({
  args: {
    days: v.optional(v.number()), // Default 30 days
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get all usage records in the time period
    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_date", (q) => q.gte("createdAt", cutoff))
      .collect();

    // Aggregate stats
    const totalCostCents = records.reduce((sum, r) => sum + r.estimatedCostCents, 0);
    const totalCalls = records.length;
    const successfulCalls = records.filter((r) => r.success).length;
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);

    // Group by action
    const byAction: Record<string, { calls: number; costCents: number; tokens: number }> = {};
    for (const r of records) {
      if (!byAction[r.action]) {
        byAction[r.action] = { calls: 0, costCents: 0, tokens: 0 };
      }
      byAction[r.action].calls++;
      byAction[r.action].costCents += r.estimatedCostCents;
      byAction[r.action].tokens += r.totalTokens;
    }

    // Group by model
    const byModel: Record<string, { calls: number; costCents: number; tokens: number }> = {};
    for (const r of records) {
      if (!byModel[r.model]) {
        byModel[r.model] = { calls: 0, costCents: 0, tokens: 0 };
      }
      byModel[r.model].calls++;
      byModel[r.model].costCents += r.estimatedCostCents;
      byModel[r.model].tokens += r.totalTokens;
    }

    // Top users by cost
    const byUser: Record<string, number> = {};
    for (const r of records) {
      const userId = r.userId || "system";
      byUser[userId] = (byUser[userId] || 0) + r.estimatedCostCents;
    }
    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, costCents]) => ({ userId, costCents }));

    // Daily breakdown
    const dailyCosts: Record<string, number> = {};
    for (const r of records) {
      const date = new Date(r.createdAt).toISOString().split("T")[0];
      dailyCosts[date] = (dailyCosts[date] || 0) + r.estimatedCostCents;
    }

    return {
      period: { days, from: cutoff, to: Date.now() },
      totals: {
        costCents: totalCostCents,
        costDollars: totalCostCents / 100,
        calls: totalCalls,
        successfulCalls,
        failedCalls: totalCalls - successfulCalls,
        tokens: totalTokens,
        avgCostPerCall: totalCalls > 0 ? totalCostCents / totalCalls : 0,
      },
      byAction,
      byModel,
      topUsers,
      dailyCosts,
    };
  },
});

/**
 * Get usage stats for a specific user
 */
export const getUserStats = query({
  args: {
    userId: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gte(q.field("createdAt"), cutoff))
      .collect();

    const totalCostCents = records.reduce((sum, r) => sum + r.estimatedCostCents, 0);
    const totalCalls = records.length;
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);

    // Group by action
    const byAction: Record<string, { calls: number; costCents: number }> = {};
    for (const r of records) {
      if (!byAction[r.action]) {
        byAction[r.action] = { calls: 0, costCents: 0 };
      }
      byAction[r.action].calls++;
      byAction[r.action].costCents += r.estimatedCostCents;
    }

    return {
      period: { days, from: cutoff, to: Date.now() },
      totals: {
        costCents: totalCostCents,
        costDollars: totalCostCents / 100,
        calls: totalCalls,
        tokens: totalTokens,
      },
      byAction,
    };
  },
});
