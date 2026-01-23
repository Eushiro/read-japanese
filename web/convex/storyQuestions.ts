import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
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
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
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
