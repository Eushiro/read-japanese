import { v } from "convex/values";

import { internalMutation, internalQuery,mutation, query } from "./_generated/server";
import { languageValidator } from "./schema";

// Question type validator (shared with storyComprehension)
const questionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("translation"),
  v.literal("short_answer"),
  v.literal("inference"),
  v.literal("prediction"),
  v.literal("grammar"),
  v.literal("opinion")
);

// Question object validator (without user-specific fields)
const questionValidator = v.object({
  questionId: v.string(),
  type: questionTypeValidator,
  question: v.string(),
  questionTranslation: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  correctAnswer: v.optional(v.string()),
  rubric: v.optional(v.string()),
  relatedChapter: v.optional(v.number()),
  points: v.number(),
});

// ============================================
// QUERIES
// ============================================

/**
 * Get cached questions for a story at a specific difficulty level
 */
export const getForStory = query({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();
  },
});

/**
 * Check if questions exist for a story at a specific difficulty
 */
export const exists = query({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();
    return existing !== null;
  },
});

/**
 * List all story questions (admin)
 * Returns aggregated stats per story (which difficulty levels have questions)
 */
export const listAllStats = query({
  args: {},
  handler: async (ctx) => {
    const allQuestions = await ctx.db.query("storyQuestions").collect();

    // Group by storyId
    const byStory: Record<
      string,
      {
        storyId: string;
        language: string;
        difficulties: number[];
        totalQuestions: number;
        generatedAt: number;
      }
    > = {};

    for (const q of allQuestions) {
      if (!byStory[q.storyId]) {
        byStory[q.storyId] = {
          storyId: q.storyId,
          language: q.language,
          difficulties: [],
          totalQuestions: 0,
          generatedAt: q.generatedAt,
        };
      }
      byStory[q.storyId].difficulties.push(q.difficulty);
      byStory[q.storyId].totalQuestions += q.questions.length;
      // Track latest generation time
      if (q.generatedAt > byStory[q.storyId].generatedAt) {
        byStory[q.storyId].generatedAt = q.generatedAt;
      }
    }

    return Object.values(byStory).map((s) => ({
      ...s,
      difficulties: s.difficulties.sort((a, b) => a - b),
    }));
  },
});

/**
 * Get all questions for a story (all difficulty levels) - admin
 */
export const getAllForStory = query({
  args: {
    storyId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) => q.eq("storyId", args.storyId))
      .collect();
  },
});

/**
 * Update a single question within a story/difficulty - admin
 */
export const updateQuestion = mutation({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
    questionIndex: v.number(),
    question: v.optional(v.string()),
    questionTranslation: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    rubric: v.optional(v.string()),
    points: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();

    if (!record) {
      throw new Error(
        `No questions found for story ${args.storyId} at difficulty ${args.difficulty}`
      );
    }

    if (args.questionIndex < 0 || args.questionIndex >= record.questions.length) {
      throw new Error(`Invalid question index: ${args.questionIndex}`);
    }

    const questions = [...record.questions];
    const currentQ = questions[args.questionIndex];

    questions[args.questionIndex] = {
      ...currentQ,
      ...(args.question !== undefined && { question: args.question }),
      ...(args.questionTranslation !== undefined && {
        questionTranslation: args.questionTranslation,
      }),
      ...(args.options !== undefined && { options: args.options }),
      ...(args.correctAnswer !== undefined && { correctAnswer: args.correctAnswer }),
      ...(args.rubric !== undefined && { rubric: args.rubric }),
      ...(args.points !== undefined && { points: args.points }),
    };

    await ctx.db.patch(record._id, { questions });
    return { success: true };
  },
});

/**
 * Delete a question from a story/difficulty - admin
 */
export const deleteQuestion = mutation({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
    questionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();

    if (!record) {
      throw new Error(
        `No questions found for story ${args.storyId} at difficulty ${args.difficulty}`
      );
    }

    if (args.questionIndex < 0 || args.questionIndex >= record.questions.length) {
      throw new Error(`Invalid question index: ${args.questionIndex}`);
    }

    const questions = record.questions.filter((_, i) => i !== args.questionIndex);

    if (questions.length === 0) {
      // Delete the entire record if no questions left
      await ctx.db.delete(record._id);
    } else {
      await ctx.db.patch(record._id, { questions });
    }

    return { success: true };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create/save questions for a story at a specific difficulty
 */
export const create = mutation({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
    language: languageValidator,
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    // Check if questions already exist
    const existing = await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("storyQuestions", {
      storyId: args.storyId,
      difficulty: args.difficulty,
      language: args.language,
      questions: args.questions,
      generatedAt: Date.now(),
    });
  },
});

/**
 * Admin: Delete questions for a story at a specific difficulty (to allow regeneration)
 */
export const remove = mutation({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Only allow admin to delete
    if (args.adminEmail !== "hiro.ayettey@gmail.com") {
      throw new Error("Unauthorized: Admin access required");
    }

    const existing = await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { deleted: true };
    }

    return { deleted: false };
  },
});

// ============================================
// INTERNAL QUERIES (for AI actions)
// ============================================

/**
 * Internal: Get cached questions for AI action
 */
export const getForStoryInternal = internalQuery({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();
  },
});

// ============================================
// INTERNAL MUTATIONS (for AI actions)
// ============================================

/**
 * Internal: Create questions from AI generation
 */
export const createFromAI = internalMutation({
  args: {
    storyId: v.string(),
    difficulty: v.number(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    // Check if questions already exist
    const existing = await ctx.db
      .query("storyQuestions")
      .withIndex("by_story_and_difficulty", (q) =>
        q.eq("storyId", args.storyId).eq("difficulty", args.difficulty)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("storyQuestions", {
      storyId: args.storyId,
      difficulty: args.difficulty,
      language: args.language,
      questions: args.questions,
      generatedAt: Date.now(),
    });
  },
});
