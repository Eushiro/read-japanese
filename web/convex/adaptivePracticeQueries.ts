import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isAdminEmail } from "./lib/admin";
import { labelToIRT } from "./lib/difficultyEstimator";
import { TEST_MODE_MODELS } from "./lib/models";
import {
  adaptiveContentTypeValidator,
  difficultyLevelValidator,
  languageValidator,
  type PrefetchStatus,
} from "./schema";

const LISTENING_TYPES = new Set(["listening_mcq", "dictation"]);
const SPEAKING_TYPES = new Set(["shadow_record"]);

function countAudioQuestions(questions: Array<{ type: string }>) {
  let listeningCount = 0;
  let speakingCount = 0;
  for (const q of questions) {
    if (LISTENING_TYPES.has(q.type)) listeningCount += 1;
    if (SPEAKING_TYPES.has(q.type)) speakingCount += 1;
  }
  return { listeningCount, speakingCount };
}

// ============================================
// QUERIES
// ============================================

/**
 * Get user's recent practice sessions
 */
export const getRecentSessions = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const exposures = await ctx.db
      .query("contentExposure")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .order("desc")
      .take(limit);

    return exposures;
  },
});

/**
 * Get the list of models used in admin test mode.
 * Single source of truth: TEST_MODE_MODELS from convex/lib/models.ts
 */
export const getTestModeModels = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!isAdminEmail(identity?.email)) return [];
    return TEST_MODE_MODELS.map((m) => ({ model: m.model, provider: m.provider }));
  },
});

// ============================================
// INTERNAL QUERIES/MUTATIONS (server-only)
// ============================================

export const getPracticeSessionInternal = internalQuery({
  args: {
    userId: v.string(),
    practiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("practiceSessions")
      .withIndex("by_practice_id", (q) => q.eq("practiceId", args.practiceId))
      .first();
    if (!session || session.userId !== args.userId) return null;
    return session;
  },
});

export const upsertPracticeSessionInternal = internalMutation({
  args: {
    userId: v.string(),
    practiceId: v.string(),
    language: languageValidator,
    isDiagnostic: v.boolean(),
    contentId: v.optional(v.string()),
    contentType: v.optional(adaptiveContentTypeValidator),
    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.string(),
        targetSkill: v.string(),
        difficulty: v.optional(difficultyLevelValidator),
      })
    ),
    modelUsed: v.optional(v.string()),
    scorerModelUsed: v.optional(v.string()),
    qualityScore: v.optional(v.number()),
    validationFailures: v.optional(v.number()),
    repairAttempts: v.optional(v.number()),
    generationLatencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("practiceSessions")
      .withIndex("by_practice_id", (q) => q.eq("practiceId", args.practiceId))
      .first();

    if (!existing) {
      const counts = countAudioQuestions(args.questions);
      await ctx.db.insert("practiceSessions", {
        userId: args.userId,
        practiceId: args.practiceId,
        language: args.language,
        isDiagnostic: args.isDiagnostic,
        contentId: args.contentId,
        contentType: args.contentType,
        questions: args.questions,
        listeningCount: counts.listeningCount,
        speakingCount: counts.speakingCount,
        modelUsed: args.modelUsed,
        scorerModelUsed: args.scorerModelUsed,
        qualityScore: args.qualityScore,
        validationFailures: args.validationFailures,
        repairAttempts: args.repairAttempts,
        generationLatencyMs: args.generationLatencyMs,
        createdAt: now,
        updatedAt: now,
      });
      return { ...counts, totalQuestions: args.questions.length };
    }

    if (existing.userId !== args.userId) {
      throw new Error("Unauthorized session update");
    }

    const questionIds = new Set(existing.questions.map((q) => q.questionId));
    const mergedQuestions = [...existing.questions];
    for (const q of args.questions) {
      if (!questionIds.has(q.questionId)) {
        mergedQuestions.push(q);
        questionIds.add(q.questionId);
      }
    }

    const counts = countAudioQuestions(mergedQuestions);

    await ctx.db.patch(existing._id, {
      language: args.language,
      isDiagnostic: args.isDiagnostic,
      contentId: args.contentId ?? existing.contentId,
      contentType: args.contentType ?? existing.contentType,
      questions: mergedQuestions,
      listeningCount: counts.listeningCount,
      speakingCount: counts.speakingCount,
      modelUsed: args.modelUsed ?? existing.modelUsed,
      scorerModelUsed: args.scorerModelUsed ?? existing.scorerModelUsed,
      qualityScore: args.qualityScore ?? existing.qualityScore,
      validationFailures: args.validationFailures ?? existing.validationFailures,
      repairAttempts: args.repairAttempts ?? existing.repairAttempts,
      generationLatencyMs: args.generationLatencyMs ?? existing.generationLatencyMs,
      updatedAt: now,
    });

    return { ...counts, totalQuestions: mergedQuestions.length };
  },
});

// ============================================
// PREFETCH SLOT SYSTEM
// ============================================

/**
 * Atomically claim a prefetch slot for a user+language.
 * Returns the new row's ID if a "generating" row was inserted, null if one already exists.
 */
export const claimPrefetchSlot = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    // Check for existing generating or ready rows
    const existing = await ctx.db
      .query("prefetchedPracticeSets")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    const active = existing.find((r) => r.status === "generating" || r.status === "ready");
    if (active) return null; // Already have an active prefetch

    const id = await ctx.db.insert("prefetchedPracticeSets", {
      userId: args.userId,
      language: args.language,
      practiceSet: "",
      status: "generating",
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * Save a generated practice set to a "generating" prefetch row, marking it "ready".
 */
export const savePrefetchedSet = internalMutation({
  args: {
    prefetchId: v.id("prefetchedPracticeSets"),
    practiceSet: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.prefetchId);
    if (!row || row.status !== "generating") return;
    await ctx.db.patch(args.prefetchId, {
      practiceSet: args.practiceSet,
      status: "ready",
    });
  },
});

/**
 * Consume a "ready" prefetch row for a user+language.
 * Marks it "consumed" and returns the serialized PracticeSet, or null if none ready.
 */
export const consumePrefetchedSet = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("prefetchedPracticeSets")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    const ready = rows.find((r) => r.status === "ready");
    if (!ready) return null;

    await ctx.db.patch(ready._id, { status: "consumed" });
    return ready.practiceSet;
  },
});

/**
 * Delete a "generating" prefetch row (used on error cleanup).
 */
export const deletePrefetchSlot = internalMutation({
  args: {
    prefetchId: v.id("prefetchedPracticeSets"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.prefetchId);
    if (row) await ctx.db.delete(args.prefetchId);
  },
});

/**
 * Invalidate (delete) any ready/generating prefetch for a user+language.
 * Called when the learner model changes (session completion).
 */
export const invalidatePrefetch = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("prefetchedPracticeSets")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    for (const row of rows) {
      if (row.status === "ready" || row.status === "generating") {
        await ctx.db.delete(row._id);
      }
    }
  },
});

/**
 * Get prefetch status for a user+language (used by frontend loading screen).
 */
export const getPrefetchStatus = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("prefetchedPracticeSets")
      .withIndex("by_user_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    const active = rows.find((r) => r.status === "generating" || r.status === "ready");
    if (!active) return null;
    return { status: active.status as PrefetchStatus };
  },
});

/**
 * Cleanup consumed and stuck generating rows (called by cron).
 */
export const cleanupPrefetchedSets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    // We can't filter by status in the index, so collect all and filter
    const allRows = await ctx.db.query("prefetchedPracticeSets").collect();

    let deleted = 0;
    for (const row of allRows) {
      if (row.status === "consumed") {
        await ctx.db.delete(row._id);
        deleted++;
      } else if (row.status === "generating" && row.createdAt < oneHourAgo) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} prefetched practice sets`);
    }
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Record a single answer immediately — updates learner model per-question.
 * Called fire-and-forget on each answer so no data is lost if user closes mid-session.
 */
export const recordAnswer = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    practiceId: v.string(),
    contentType: v.optional(adaptiveContentTypeValidator),
    isDiagnostic: v.optional(v.boolean()),
    questionId: v.string(),
    questionText: v.string(),
    questionType: v.string(),
    targetSkill: v.string(),
    difficulty: v.optional(difficultyLevelValidator),
    difficultyNumeric: v.optional(v.number()),
    userAnswer: v.string(),
    selectedOption: v.optional(v.string()), // For MCQ: which option was picked (for distractor analysis)
    passageText: v.optional(v.string()),
    isCorrect: v.boolean(),
    earnedPoints: v.number(),
    maxPoints: v.number(),
    responseTimeMs: v.optional(v.number()),
    skipped: v.optional(v.boolean()),
    // Pool tracking: hash links answer to pool question for stat calibration
    questionHash: v.string(),
    abilityEstimate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Don't record or update model for skipped questions
    if (args.skipped) return;

    // Idempotency: check if this answer was already recorded (e.g. session restored from sessionStorage)
    const recentHistory = await ctx.db
      .query("questionHistory")
      .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
    const alreadyRecorded = recentHistory.some(
      (h) => h.sourceId === args.practiceId && h.questionContent.questionText === args.questionText
    );
    if (alreadyRecorded) return;

    // 1. Save to questionHistory
    await ctx.db.insert("questionHistory", {
      userId: args.userId,
      language: args.language,
      sourceType: args.isDiagnostic ? "placement" : "comprehension",
      sourceId: args.practiceId,
      questionContent: {
        questionText: args.questionText,
        questionType: args.questionType,
        ...(args.passageText ? { passageText: args.passageText } : {}),
      },
      userAnswer: args.userAnswer,
      selectedOption: args.selectedOption,
      responseTimeMs: args.responseTimeMs,
      skills: [{ skill: args.targetSkill, weight: 1 }],
      difficulty: args.difficultyNumeric ?? labelToIRT(args.difficulty),
      grading: {
        isCorrect: args.isCorrect,
        score: args.maxPoints > 0 ? args.earnedPoints / args.maxPoints : 0,
        gradedAt: Date.now(),
      },
      answeredAt: Date.now(),
    });

    // 2. Update question pool stats (if the question exists in the pool)
    await ctx.runMutation(internal.questionPoolQueries.updateQuestionStats, {
      questionHash: args.questionHash,
      isCorrect: args.isCorrect,
      responseTimeMs: args.responseTimeMs,
      selectedOption: args.selectedOption,
      userAbilityEstimate: args.abilityEstimate,
      userId: args.userId,
      language: args.language,
    });

    // Learner model update is deferred to session end (submitPractice / flushLearnerModel)
    // to avoid N table patches per session that cascade re-evaluations.
  },
});

/**
 * Submit practice session — lightweight, just records session-level stats.
 * Individual answers are already recorded via recordAnswer.
 */
export const submitPractice = mutation({
  args: {
    userId: v.string(),
    practiceId: v.string(),
    contentId: v.optional(v.string()),
    contentType: v.optional(adaptiveContentTypeValidator),
    language: languageValidator,
    isDiagnostic: v.optional(v.boolean()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        earnedPoints: v.number(),
        responseTimeMs: v.optional(v.number()),
      })
    ),
    totalScore: v.number(),
    maxScore: v.number(),
    dwellMs: v.optional(v.number()),
    targetSkills: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const percentScore = args.maxScore > 0 ? (args.totalScore / args.maxScore) * 100 : 0;

    // Log exposure (only for normal mode with content)
    if (!args.isDiagnostic && args.contentId && args.contentType) {
      await ctx.runMutation(api.contentEngineQueries.logExposure, {
        userId: args.userId,
        contentId: args.contentId,
        contentType: args.contentType,
        language: args.language,
        servedAt: Date.now() - (args.dwellMs ?? 0),
        completedAt: Date.now(),
        score: percentScore,
        source: "generated",
        dwellMs: args.dwellMs,
        skillsTested: args.targetSkills.map((skill) => ({
          skill,
          weight: 1 / args.targetSkills.length,
        })),
      });
    }

    // Batch learner model update at session end (one update per unique skill)
    await ctx.runMutation(internal.adaptivePracticeQueries.flushLearnerModel, {
      userId: args.userId,
      language: args.language,
      practiceId: args.practiceId,
      contentType: args.contentType ?? "dialogue",
      targetSkills: args.targetSkills,
      answers: args.answers,
    });

    return {
      totalScore: args.totalScore,
      maxScore: args.maxScore,
      percentScore,
      correctCount: args.answers.filter((a) => a.isCorrect).length,
      totalQuestions: args.answers.length,
    };
  },
});

/**
 * Batch learner model update — aggregates per-question scores by skill
 * and issues a single updateFromAdaptiveContent call per unique skill.
 * Called at session end from submitPractice.
 */
export const flushLearnerModel = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    practiceId: v.string(),
    contentType: v.string(),
    targetSkills: v.array(v.string()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        earnedPoints: v.number(),
        responseTimeMs: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.answers.length === 0) return;

    // Look up the practice session to get per-question skill + difficulty info
    const session = await ctx.db
      .query("practiceSessions")
      .withIndex("by_practice_id", (q) => q.eq("practiceId", args.practiceId))
      .first();

    // Build a map of questionId → { targetSkill, difficulty }
    const questionMeta = new Map<string, { targetSkill: string; difficulty?: string }>();
    if (session?.questions) {
      for (const q of session.questions) {
        questionMeta.set(q.questionId, {
          targetSkill: q.targetSkill,
          difficulty: q.difficulty,
        });
      }
    }

    // Aggregate scores per skill
    const skillAgg = new Map<string, { totalScore: number; count: number; diffSum: number }>();
    for (const a of args.answers) {
      const meta = questionMeta.get(a.questionId);
      const skill = meta?.targetSkill ?? "vocabulary";
      const diffEstimate = labelToIRT(meta?.difficulty);
      const score = a.isCorrect ? 100 : 0;

      const existing = skillAgg.get(skill);
      if (existing) {
        existing.totalScore += score;
        existing.count += 1;
        existing.diffSum += diffEstimate;
      } else {
        skillAgg.set(skill, { totalScore: score, count: 1, diffSum: diffEstimate });
      }
    }

    // Issue one learner model update per unique skill
    for (const [skill, agg] of skillAgg) {
      const avgScore = agg.totalScore / agg.count;
      const avgDiff = agg.diffSum / agg.count;

      await ctx.runMutation(internal.learnerModel.updateFromAdaptiveContent, {
        userId: args.userId,
        language: args.language,
        contentId: args.practiceId,
        contentType: args.contentType,
        difficultyEstimate: avgDiff,
        skillsTested: [{ skill, weight: 1 }],
        score: avgScore,
      });
    }

    // Invalidate stale prefetched sets (learner model just changed)
    await ctx.runMutation(internal.adaptivePracticeQueries.invalidatePrefetch, {
      userId: args.userId,
      language: args.language,
    });

    // Schedule a new prefetch for the next session
    await ctx.scheduler.runAfter(0, internal.adaptivePractice.prefetchPractice, {
      userId: args.userId,
      language: args.language,
    });
  },
});
