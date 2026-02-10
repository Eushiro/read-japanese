/**
 * Question Pool queries and mutations (non-Node.js runtime).
 *
 * These are the database operations that support the question pool actions.
 * Separated from questionPool.ts because Convex queries/mutations cannot use "use node".
 */

import { v } from "convex/values";

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

/**
 * Batch dedup check: given an array of hashes, return which ones already exist in the pool.
 * Replaces N individual getByHash calls with a single query call.
 */
export const getExistingHashes = internalQuery({
  args: { hashes: v.array(v.string()), language: languageValidator },
  handler: async (ctx, args) => {
    // Fetch recent pool entries (last 24h) as a Set of hashes.
    // Questions being ingested were just generated, so most dups are recent.
    const oneDayAgo = Date.now() - 86_400_000;
    const recentDocs = await ctx.db
      .query("questionPool")
      .withIndex("by_language_difficulty", (q) => q.eq("language", args.language))
      .filter((q) => q.gte(q.field("generatedAt"), oneDayAgo))
      .take(500);
    const recentHashes = new Set(recentDocs.map((d) => d.questionHash));

    // Check each hash against the Set first, only do index lookup for misses
    const existing: string[] = [];
    for (const hash of args.hashes) {
      if (recentHashes.has(hash)) {
        existing.push(hash);
      } else {
        const doc = await ctx.db
          .query("questionPool")
          .withIndex("by_hash", (q) => q.eq("questionHash", hash))
          .first();
        if (doc) existing.push(hash);
      }
    }
    return existing;
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
      .order("desc")
      .take(2000);

    return exposures.map((e) => e.questionHash);
  },
});

/**
 * Fetch pool candidates by language + difficulty, and also return the total
 * pool size for the language. Combines the old getPoolCandidates + getPoolSize
 * into a single query to avoid a separate DB round-trip.
 */
export const getPoolCandidatesWithCount = internalQuery({
  args: {
    language: languageValidator,
    difficulties: v.array(difficultyLevelValidator),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Query each difficulty level and merge results
    const perDiffLimit = Math.ceil(args.limit / args.difficulties.length);
    const allCandidates = [];
    for (const diff of args.difficulties) {
      const batch = await ctx.db
        .query("questionPool")
        .withIndex("by_language_difficulty", (q) =>
          q.eq("language", args.language).eq("difficulty", diff)
        )
        .take(perDiffLimit);
      allCandidates.push(...batch);
    }

    // Sequential threshold checks: read at most 200 docs instead of 1000.
    // The caller only needs buckets (<50, <200, >=200).
    const sample = await ctx.db
      .query("questionPool")
      .withIndex("by_language_skill_difficulty", (q) => q.eq("language", args.language))
      .take(200);
    const poolSize = sample.length >= 200 ? 1000 : sample.length;

    return { candidates: allCandidates, poolSize };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Batch insert multiple questions into the pool in a single transaction.
 * Replaces N individual insertPoolQuestion calls with one mutation.
 */
export const insertPoolQuestions = internalMutation({
  args: {
    questions: v.array(
      v.object({
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
        modelUsed: v.optional(v.string()),
        qualityScore: v.optional(v.number()),
        translations: v.optional(translationMapValidator),
        optionTranslations: v.optional(v.union(optionTranslationMapValidator, v.null())),
        showOptionsInTargetLanguage: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const q of args.questions) {
      await ctx.db.insert("questionPool", {
        questionHash: q.questionHash,
        language: q.language,
        questionType: q.questionType,
        targetSkill: q.targetSkill,
        difficulty: q.difficulty,
        question: q.question,
        passageText: q.passageText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        acceptableAnswers: q.acceptableAnswers,
        points: q.points,
        grammarTags: q.grammarTags,
        vocabTags: q.vocabTags,
        topicTags: q.topicTags,
        totalResponses: 0,
        correctResponses: 0,
        avgResponseTimeMs: 0,
        qualityScore: q.qualityScore,
        modelUsed: q.modelUsed,
        generatedAt: now,
        isStandalone: true,
        translations: q.translations,
        optionTranslations: q.optionTranslations,
        showOptionsInTargetLanguage: q.showOptionsInTargetLanguage,
      });
    }
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

    // Update distractor counts for MCQ questions (use index-based keys to avoid non-ASCII characters)
    let distractorCounts = (poolQuestion.distractorCounts as Record<string, number>) ?? {};
    if (args.selectedOption && poolQuestion.options) {
      const optionIndex = poolQuestion.options.indexOf(args.selectedOption);
      if (optionIndex !== -1) {
        const key = String(optionIndex);
        distractorCounts = { ...distractorCounts };
        distractorCounts[key] = (distractorCounts[key] ?? 0) + 1;
      }
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
