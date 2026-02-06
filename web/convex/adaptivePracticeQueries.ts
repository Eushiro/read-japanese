import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { isAdminEmail } from "./lib/admin";
import { TEST_MODE_MODELS } from "./lib/models";
import { adaptiveContentTypeValidator, languageValidator } from "./schema";

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
    questionId: v.string(),
    questionText: v.string(),
    questionType: v.string(),
    targetSkill: v.string(),
    difficulty: v.optional(v.string()),
    userAnswer: v.string(),
    selectedOption: v.optional(v.string()), // For MCQ: which option was picked (for distractor analysis)
    isCorrect: v.boolean(),
    earnedPoints: v.number(),
    maxPoints: v.number(),
    responseTimeMs: v.optional(v.number()),
    skipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Don't record or update model for skipped questions
    if (args.skipped) return;

    // 1. Save to questionHistory
    await ctx.db.insert("questionHistory", {
      userId: args.userId,
      language: args.language,
      sourceType: "comprehension",
      sourceId: args.practiceId,
      questionContent: {
        questionText: args.questionText,
        questionType: args.questionType,
      },
      userAnswer: args.userAnswer,
      selectedOption: args.selectedOption,
      responseTimeMs: args.responseTimeMs,
      skills: [{ skill: args.targetSkill, weight: 1 }],
      difficulty: args.difficulty === "easy" ? -1 : args.difficulty === "hard" ? 1 : 0,
      grading: {
        isCorrect: args.isCorrect,
        score: args.maxPoints > 0 ? args.earnedPoints / args.maxPoints : 0,
        gradedAt: Date.now(),
      },
      answeredAt: Date.now(),
    });

    // 2. Update learner model per-question
    const score =
      args.maxPoints > 0 ? (args.earnedPoints / args.maxPoints) * 100 : args.isCorrect ? 100 : 0;
    const difficultyEstimate = args.difficulty === "easy" ? -1 : args.difficulty === "hard" ? 1 : 0;

    await ctx.runMutation(internal.learnerModel.updateFromAdaptiveContent, {
      userId: args.userId,
      language: args.language,
      contentId: args.practiceId,
      contentType: "dialogue",
      difficultyEstimate,
      skillsTested: [{ skill: args.targetSkill, weight: 1 }],
      score,
    });
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

    // No need to insert questionHistory or update learner model here —
    // recordAnswer already handles per-question updates.

    return {
      totalScore: args.totalScore,
      maxScore: args.maxScore,
      percentScore,
      correctCount: args.answers.filter((a) => a.isCorrect).length,
      totalQuestions: args.answers.length,
    };
  },
});
