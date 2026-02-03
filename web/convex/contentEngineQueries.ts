import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import {
  adaptiveContentTypeValidator,
  contentAudienceScopeValidator,
  languageValidator,
  learningGoalValidator,
} from "./schema";

// ============================================
// INTERNAL QUERIES
// ============================================

export const getReuseCandidates = internalQuery({
  args: {
    language: languageValidator,
    contentType: adaptiveContentTypeValidator,
    minDifficulty: v.number(),
    maxDifficulty: v.number(),
    goal: v.optional(learningGoalValidator),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("contentItems")
      .withIndex("by_language_type_difficulty", (q) =>
        q
          .eq("language", args.language)
          .eq("contentType", args.contentType)
          .gte("difficultyEstimate", args.minDifficulty)
          .lte("difficultyEstimate", args.maxDifficulty)
      )
      .collect();

    if (!args.goal) return candidates;

    return candidates.filter((item) => item.goalTags.includes(args.goal!));
  },
});

export const getRecentExposureIds = internalQuery({
  args: {
    userId: v.string(),
    language: languageValidator,
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const exposures = await ctx.db
      .query("contentExposure")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .filter((q) => q.gte(q.field("servedAt"), args.since))
      .collect();

    return exposures.map((exposure) => exposure.contentId);
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

export const insertContentItem = internalMutation({
  args: {
    contentId: v.string(),
    contentType: adaptiveContentTypeValidator,
    language: languageValidator,
    difficultyEstimate: v.number(),
    vocabList: v.array(v.string()),
    grammarTags: v.array(v.string()),
    topicTags: v.array(v.string()),
    goalTags: v.array(v.string()),
    modelId: v.string(),
    contentUrl: v.string(),
    audienceScope: contentAudienceScopeValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("contentItems", {
      ...args,
      impressions: 0,
      completionRate: 0,
      avgScore: 0,
      tooHardRate: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const insertContentCandidate = internalMutation({
  args: {
    runId: v.string(),
    candidateId: v.string(),
    modelId: v.string(),
    contentType: adaptiveContentTypeValidator,
    language: languageValidator,
    candidateUrl: v.string(),
    constraints: v.object({
      coverage: v.number(),
      newWordCount: v.number(),
      grammarMatch: v.boolean(),
      lengthOk: v.boolean(),
    }),
    scores: v.object({
      difficultyFit: v.number(),
      interestFit: v.number(),
      clarity: v.number(),
      novelty: v.number(),
      total: v.number(),
    }),
    gradingFeedback: v.string(),
    gradingScore: v.number(),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contentCandidates", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const insertSelectionRun = internalMutation({
  args: {
    runId: v.string(),
    userId: v.string(),
    language: languageValidator,
    contentType: adaptiveContentTypeValidator,
    requestSpec: v.object({
      difficultyTarget: v.number(),
      vocabBudget: v.number(),
      topicTags: v.array(v.string()),
      goal: v.optional(learningGoalValidator),
    }),
    candidateIds: v.array(v.string()),
    selectedCandidateId: v.string(),
    selectionReason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contentSelectionRuns", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

function defaultSkillsForContentType(contentType: "dialogue" | "micro_story") {
  if (contentType === "dialogue") {
    return [
      { skill: "reading", weight: 0.7 },
      { skill: "vocabulary", weight: 0.3 },
    ];
  }

  return [
    { skill: "reading", weight: 0.8 },
    { skill: "vocabulary", weight: 0.2 },
  ];
}

export const logExposure = mutation({
  args: {
    userId: v.string(),
    contentId: v.string(),
    contentType: adaptiveContentTypeValidator,
    language: languageValidator,
    servedAt: v.number(),
    completedAt: v.optional(v.number()),
    score: v.optional(v.number()),
    rating: v.optional(v.number()),
    source: v.union(v.literal("reused"), v.literal("generated")),
    dwellMs: v.optional(v.number()),
    replays: v.optional(v.number()),
    skips: v.optional(v.number()),
    topicTags: v.optional(v.array(v.string())),
    confidence: v.optional(v.number()),
    estimatedWordCount: v.optional(v.number()),
    skillsTested: v.optional(
      v.array(
        v.object({
          skill: v.string(),
          weight: v.number(),
        })
      )
    ),
    difficultyEstimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { confidence, estimatedWordCount, skillsTested, difficultyEstimate, ...exposureData } =
      args;

    // Store exposure with engagement metrics
    await ctx.db.insert("contentExposure", {
      userId: exposureData.userId,
      contentId: exposureData.contentId,
      contentType: exposureData.contentType,
      language: exposureData.language,
      servedAt: exposureData.servedAt,
      completedAt: exposureData.completedAt,
      score: exposureData.score,
      rating: exposureData.rating,
      source: exposureData.source,
      // Engagement metrics (now persisted)
      dwellMs: exposureData.dwellMs,
      replays: exposureData.replays,
      skips: exposureData.skips,
      topicTags: exposureData.topicTags,
    });

    const item = await ctx.db
      .query("contentItems")
      .withIndex("by_content_id", (q) => q.eq("contentId", args.contentId))
      .first();

    if (!item) return;

    const impressions = item.impressions + 1;
    const avgScore =
      args.score === undefined
        ? item.avgScore
        : (item.avgScore * item.impressions + args.score) / impressions;
    const completionDelta = args.completedAt ? 1 : 0;
    const completionRate = (item.completionRate * item.impressions + completionDelta) / impressions;
    const tooHardDelta = args.score !== undefined && args.score < 60 ? 1 : 0;
    const tooHardRate = (item.tooHardRate * item.impressions + tooHardDelta) / impressions;

    await ctx.db.patch(item._id, {
      impressions,
      avgScore,
      completionRate,
      tooHardRate,
      updatedAt: Date.now(),
    });

    if (args.score !== undefined) {
      await ctx.runMutation(internal.learnerModel.updateFromAdaptiveContent, {
        userId: args.userId,
        language: args.language,
        contentId: args.contentId,
        contentType: args.contentType,
        difficultyEstimate: item?.difficultyEstimate ?? difficultyEstimate ?? 0,
        skillsTested: skillsTested ?? defaultSkillsForContentType(args.contentType),
        score: args.score,
        rating: args.rating,
        dwellMs: exposureData.dwellMs,
        replays: exposureData.replays,
        skips: exposureData.skips,
        topicTags: exposureData.topicTags ?? item?.topicTags ?? [],
        confidence,
        estimatedWordCount: estimatedWordCount ?? item?.vocabList?.length ?? 100,
        completed: !!args.completedAt,
      });
    }
  },
});
