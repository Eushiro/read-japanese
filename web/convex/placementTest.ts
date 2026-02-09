import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { languageValidator, proficiencyLevelValidator } from "./schema";

const DEPRECATED_MESSAGE = "Placement tests are deprecated. Use diagnostic mode.";

async function warnDeprecated(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string; email?: string } | null> } },
  fn: string,
  details?: Record<string, unknown>
) {
  const identity = await ctx.auth.getUserIdentity();
  console.warn(`[Deprecated] placementTest.${fn} called`, {
    subject: identity?.subject,
    email: identity?.email,
    ...(details ?? {}),
  });
}

// ============================================
// QUERIES
// ============================================

export const getForUser = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "getForUser", { userId: args.userId, language: args.language });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const get = query({
  args: {
    id: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "get", { id: args.id });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const getUserLevel = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "getUserLevel", { userId: args.userId, language: args.language });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const getGradingProfile = query({
  args: {
    language: languageValidator,
    level: proficiencyLevelValidator,
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "getGradingProfile", {
      language: args.language,
      level: args.level,
    });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "create", { userId: args.userId, language: args.language });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const addQuestion = mutation({
  args: {
    testId: v.id("placementTests"),
    question: v.object({
      questionId: v.string(),
      level: proficiencyLevelValidator,
      type: v.union(
        v.literal("vocabulary"),
        v.literal("grammar"),
        v.literal("reading"),
        v.literal("listening")
      ),
      question: v.string(),
      questionTranslation: v.optional(v.string()),
      options: v.array(v.string()),
      correctAnswer: v.string(),
      difficulty: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "addQuestion", { testId: args.testId });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const submitAnswer = mutation({
  args: {
    testId: v.id("placementTests"),
    questionIndex: v.number(),
    answer: v.string(),
    responseTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "submitAnswer", { testId: args.testId });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const complete = mutation({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "complete", { testId: args.testId });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const abandon = mutation({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "abandon", { testId: args.testId });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

export const reset = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "reset", { userId: args.userId, language: args.language });
    throw new Error(DEPRECATED_MESSAGE);
  },
});

// ============================================
// INTERNAL MUTATIONS (for AI actions)
// ============================================

export const addQuestionFromAI = internalMutation({
  args: {
    testId: v.id("placementTests"),
    question: v.object({
      questionId: v.string(),
      level: proficiencyLevelValidator,
      type: v.union(
        v.literal("vocabulary"),
        v.literal("grammar"),
        v.literal("reading"),
        v.literal("listening")
      ),
      question: v.string(),
      questionTranslation: v.optional(v.string()),
      options: v.array(v.string()),
      correctAnswer: v.string(),
      difficulty: v.number(),
      audioUrl: v.optional(v.string()),
      audioTranscript: v.optional(v.string()),
      isWarmup: v.optional(v.boolean()),
      modelUsed: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await warnDeprecated(ctx, "addQuestionFromAI", { testId: args.testId });
    throw new Error(DEPRECATED_MESSAGE);
  },
});
