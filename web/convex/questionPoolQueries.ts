/**
 * Question Pool queries and mutations (non-Node.js runtime).
 *
 * These are the database operations that support the question pool actions.
 * Separated from questionPool.ts because Convex queries/mutations cannot use "use node".
 */

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  difficultyLevelValidator,
  languageValidator,
  optionTranslationMapValidator,
  practiceQuestionTypeValidator,
  skillTypeValidator,
  translationMapValidator,
} from "./schema";

// ============================================
// QUERIES
// ============================================

export const getByHash = internalQuery({
  args: { questionHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("questionPool")
      .withIndex("by_hash", (q) => q.eq("questionHash", args.questionHash))
      .first();
  },
});

export const getQuestionsByIds = internalQuery({
  args: {
    ids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.ids) {
      try {
        const doc = await ctx.db.get(id as Id<"questionPool">);
        if (doc) results.push(doc);
      } catch {
        // Skip invalid IDs
      }
    }
    return results;
  },
});

export const getUserSeenHashes = internalQuery({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const exposures = await ctx.db
      .query("questionExposure")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    return exposures.map((e) => e.questionHash);
  },
});

export const getPoolSize = internalQuery({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("questionPool")
      .withIndex("by_language_skill_difficulty", (q) => q.eq("language", args.language))
      .collect();

    return questions.length;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const insertPoolQuestion = internalMutation({
  args: {
    questionHash: v.string(),
    language: languageValidator,
    questionType: practiceQuestionTypeValidator,
    targetSkill: skillTypeValidator,
    difficulty: difficultyLevelValidator,
    question: v.string(),
    passageText: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.string(),
    acceptableAnswers: v.optional(v.array(v.string())),
    points: v.number(),
    grammarTags: v.array(v.string()),
    vocabTags: v.array(v.string()),
    topicTags: v.array(v.string()),
    embedding: v.array(v.float64()),
    modelUsed: v.optional(v.string()),
    qualityScore: v.optional(v.number()),
    translations: v.optional(translationMapValidator),
    optionTranslations: v.optional(v.union(optionTranslationMapValidator, v.null())),
    showOptionsInTargetLanguage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("questionPool", {
      questionHash: args.questionHash,
      language: args.language,
      questionType: args.questionType,
      targetSkill: args.targetSkill,
      difficulty: args.difficulty,
      question: args.question,
      passageText: args.passageText,
      options: args.options,
      correctAnswer: args.correctAnswer,
      acceptableAnswers: args.acceptableAnswers,
      points: args.points,
      grammarTags: args.grammarTags,
      vocabTags: args.vocabTags,
      topicTags: args.topicTags,
      embedding: args.embedding,
      totalResponses: 0,
      correctResponses: 0,
      avgResponseTimeMs: 0,
      qualityScore: args.qualityScore,
      modelUsed: args.modelUsed,
      generatedAt: Date.now(),
      isStandalone: true,
      translations: args.translations,
      optionTranslations: args.optionTranslations,
      showOptionsInTargetLanguage: args.showOptionsInTargetLanguage,
    });
  },
});

/**
 * Update pool question statistics after a user answers.
 * Handles running averages and IRT recalibration on a phased schedule.
 */
export const updateQuestionStats = internalMutation({
  args: {
    questionHash: v.string(),
    isCorrect: v.boolean(),
    responseTimeMs: v.optional(v.number()),
    selectedOption: v.optional(v.string()),
    userAbilityEstimate: v.optional(v.number()),
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const poolQuestion = await ctx.db
      .query("questionPool")
      .withIndex("by_hash", (q) => q.eq("questionHash", args.questionHash))
      .first();

    if (!poolQuestion) return;

    const now = Date.now();
    const newTotal = poolQuestion.totalResponses + 1;
    const newCorrect = poolQuestion.correctResponses + (args.isCorrect ? 1 : 0);

    // Running average for response time
    let newAvgTime = poolQuestion.avgResponseTimeMs;
    if (args.responseTimeMs) {
      if (poolQuestion.totalResponses === 0) {
        newAvgTime = args.responseTimeMs;
      } else {
        newAvgTime =
          (poolQuestion.avgResponseTimeMs * poolQuestion.totalResponses + args.responseTimeMs) /
          newTotal;
      }
    }

    // Update distractor counts for MCQ questions
    let distractorCounts = (poolQuestion.distractorCounts as Record<string, number>) ?? {};
    if (args.selectedOption && poolQuestion.options) {
      distractorCounts = { ...distractorCounts };
      distractorCounts[args.selectedOption] = (distractorCounts[args.selectedOption] ?? 0) + 1;
    }

    // Calibrate difficulty based on response count
    let empiricalDifficulty = poolQuestion.empiricalDifficulty;
    let discrimination = poolQuestion.discrimination;
    let flagged = poolQuestion.flagged;

    const correctRate = newCorrect / newTotal;

    if (newTotal >= 20) {
      // Rasch/2PL IRT: difficulty = -ln(p / (1 - p))
      const clampedRate = Math.max(0.01, Math.min(0.99, correctRate));
      empiricalDifficulty = -Math.log(clampedRate / (1 - clampedRate));
    }

    if (newTotal >= 50) {
      // Discrimination proxy: items near 50% correctRate discriminate best.
      // Uses P*(1-P) which peaks at 0.25 when P=0.5, scaled to [0, 2].
      const clampedRate = Math.max(0.01, Math.min(0.99, correctRate));
      const variance = clampedRate * (1 - clampedRate); // max 0.25 at P=0.5
      discrimination = variance * 8; // maps 0.25 → 2.0, extremes → ~0
    }

    // Flag abnormal questions
    if (newTotal >= 20) {
      flagged =
        correctRate < 0.1 ||
        correctRate > 0.95 ||
        (discrimination !== undefined && discrimination < 0.3);
    }

    await ctx.db.patch(poolQuestion._id, {
      totalResponses: newTotal,
      correctResponses: newCorrect,
      avgResponseTimeMs: newAvgTime,
      distractorCounts,
      empiricalDifficulty,
      discrimination,
      flagged,
    });

    // Record exposure
    await ctx.db.insert("questionExposure", {
      userId: args.userId,
      questionHash: args.questionHash,
      language: args.language,
      servedAt: now,
      isCorrect: args.isCorrect,
      userAbilityAtTime: args.userAbilityEstimate,
    });
  },
});
