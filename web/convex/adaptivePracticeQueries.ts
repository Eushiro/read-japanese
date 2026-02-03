import { v } from "convex/values";

import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
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

// ============================================
// MUTATIONS
// ============================================

/**
 * Submit practice answers and get results
 */
export const submitPractice = mutation({
  args: {
    userId: v.string(),
    practiceId: v.string(),
    contentId: v.string(),
    contentType: adaptiveContentTypeValidator,
    language: languageValidator,
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

    // Log exposure with engagement
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

    // Store individual question responses for analysis
    for (const answer of args.answers) {
      await ctx.db.insert("questionHistory", {
        userId: args.userId,
        language: args.language,
        sourceType: "comprehension",
        sourceId: args.practiceId,
        questionContent: {
          questionText: answer.questionId,
          questionType: "practice",
        },
        userAnswer: answer.userAnswer,
        responseTimeMs: answer.responseTimeMs,
        skills: args.targetSkills.map((skill) => ({
          skill,
          weight: 1 / args.targetSkills.length,
        })),
        grading: {
          isCorrect: answer.isCorrect,
          score: answer.earnedPoints,
          gradedAt: Date.now(),
        },
        answeredAt: Date.now(),
      });
    }

    return {
      totalScore: args.totalScore,
      maxScore: args.maxScore,
      percentScore,
      correctCount: args.answers.filter((a) => a.isCorrect).length,
      totalQuestions: args.answers.length,
    };
  },
});
