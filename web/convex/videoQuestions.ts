import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { languageValidator } from "./schema";

// Question type validator
const questionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("translation"),
  v.literal("short_answer"),
  v.literal("inference"),
  v.literal("listening"),
  v.literal("grammar"),
  v.literal("opinion")
);

// Question object validator
const questionValidator = v.object({
  questionId: v.string(),
  type: questionTypeValidator,
  question: v.string(),
  questionTranslation: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  correctAnswer: v.optional(v.string()),
  rubric: v.optional(v.string()),
  timestamp: v.optional(v.number()),
  points: v.number(),
});

// ============================================
// QUERIES
// ============================================

/**
 * Get questions for a video at a specific difficulty level
 */
export const getForVideo = query({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();
  },
});

/**
 * Check if questions exist for a video at a specific difficulty
 */
export const exists = query({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();
    return existing !== null;
  },
});

/**
 * List all video questions stats (admin)
 */
export const listAllStats = query({
  args: {},
  handler: async (ctx) => {
    const allQuestions = await ctx.db.query("videoQuestions").collect();

    // Group by videoId
    const byVideo: Record<
      string,
      {
        videoId: string;
        language: string;
        difficulties: number[];
        totalQuestions: number;
        generatedAt: number;
      }
    > = {};

    for (const q of allQuestions) {
      if (!byVideo[q.videoId]) {
        byVideo[q.videoId] = {
          videoId: q.videoId,
          language: q.language,
          difficulties: [],
          totalQuestions: 0,
          generatedAt: q.generatedAt,
        };
      }
      byVideo[q.videoId].difficulties.push(q.difficulty);
      byVideo[q.videoId].totalQuestions += q.questions.length;
      if (q.generatedAt > byVideo[q.videoId].generatedAt) {
        byVideo[q.videoId].generatedAt = q.generatedAt;
      }
    }

    return Object.values(byVideo).map((v) => ({
      ...v,
      difficulties: v.difficulties.sort((a, b) => a - b),
    }));
  },
});

/**
 * Get all questions for a video (all difficulty levels) - admin
 */
export const getAllForVideo = query({
  args: {
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoQuestions")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .collect();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create/save questions for a video at a specific difficulty
 */
export const create = mutation({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
    language: languageValidator,
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    // Check if questions already exist
    const existing = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        questions: args.questions,
        generatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("videoQuestions", {
      videoId: args.videoId,
      difficulty: args.difficulty,
      language: args.language,
      questions: args.questions,
      generatedAt: Date.now(),
    });
  },
});

/**
 * Update a single question within a video/difficulty - admin
 */
export const updateQuestion = mutation({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
    questionIndex: v.number(),
    question: v.optional(v.string()),
    questionTranslation: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    rubric: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    points: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();

    if (!record) {
      throw new Error(`No questions found for video ${args.videoId} at difficulty ${args.difficulty}`);
    }

    if (args.questionIndex < 0 || args.questionIndex >= record.questions.length) {
      throw new Error(`Invalid question index: ${args.questionIndex}`);
    }

    const questions = [...record.questions];
    const currentQ = questions[args.questionIndex];

    questions[args.questionIndex] = {
      ...currentQ,
      ...(args.question !== undefined && { question: args.question }),
      ...(args.questionTranslation !== undefined && { questionTranslation: args.questionTranslation }),
      ...(args.options !== undefined && { options: args.options }),
      ...(args.correctAnswer !== undefined && { correctAnswer: args.correctAnswer }),
      ...(args.rubric !== undefined && { rubric: args.rubric }),
      ...(args.timestamp !== undefined && { timestamp: args.timestamp }),
      ...(args.points !== undefined && { points: args.points }),
    };

    await ctx.db.patch(record._id, { questions });
    return { success: true };
  },
});

/**
 * Delete a question from a video/difficulty - admin
 */
export const deleteQuestion = mutation({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
    questionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();

    if (!record) {
      throw new Error(`No questions found for video ${args.videoId} at difficulty ${args.difficulty}`);
    }

    if (args.questionIndex < 0 || args.questionIndex >= record.questions.length) {
      throw new Error(`Invalid question index: ${args.questionIndex}`);
    }

    const questions = record.questions.filter((_, i) => i !== args.questionIndex);

    if (questions.length === 0) {
      await ctx.db.delete(record._id);
    } else {
      await ctx.db.patch(record._id, { questions });
    }

    return { success: true };
  },
});

/**
 * Delete all questions for a video at a specific difficulty - admin
 */
export const remove = mutation({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Only allow admin to delete
    if (args.adminEmail !== "hiro.ayettey@gmail.com") {
      throw new Error("Unauthorized: Admin access required");
    }

    const existing = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { deleted: true };
    }

    return { deleted: false };
  },
});

/**
 * Add a new question to a video/difficulty - admin
 */
export const addQuestion = mutation({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
    language: languageValidator,
    question: questionValidator,
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();

    if (record) {
      // Add to existing
      await ctx.db.patch(record._id, {
        questions: [...record.questions, args.question],
      });
      return record._id;
    } else {
      // Create new record
      return await ctx.db.insert("videoQuestions", {
        videoId: args.videoId,
        difficulty: args.difficulty,
        language: args.language,
        questions: [args.question],
        generatedAt: Date.now(),
      });
    }
  },
});

// ============================================
// INTERNAL (for AI actions)
// ============================================

export const getForVideoInternal = internalQuery({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();
  },
});

export const createFromAI = internalMutation({
  args: {
    videoId: v.string(),
    difficulty: v.number(),
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoQuestions")
      .withIndex("by_video_and_difficulty", (q) =>
        q.eq("videoId", args.videoId).eq("difficulty", args.difficulty)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("videoQuestions", {
      videoId: args.videoId,
      difficulty: args.difficulty,
      language: args.language,
      questions: args.questions,
      generatedAt: Date.now(),
    });
  },
});

