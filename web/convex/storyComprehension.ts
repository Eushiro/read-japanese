import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { languageValidator } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

// ============================================
// QUERIES
// ============================================

/**
 * Get comprehension quiz for a specific story
 */
export const getForStory = query({
  args: {
    userId: v.string(),
    storyId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyComprehension")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();
  },
});

/**
 * Get comprehension by ID
 */
export const get = query({
  args: {
    id: v.id("storyComprehension"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get user's comprehension stats
 */
export const getStats = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    let comprehensions;

    if (args.language !== undefined) {
      const lang = args.language;
      comprehensions = await ctx.db
        .query("storyComprehension")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", lang)
        )
        .collect();
    } else {
      comprehensions = await ctx.db
        .query("storyComprehension")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const completed = comprehensions.filter((c) => c.completedAt !== undefined);

    const totalScore = completed.reduce((sum, c) => sum + (c.earnedScore ?? 0), 0);
    const maxScore = completed.reduce((sum, c) => sum + c.totalScore, 0);

    return {
      totalQuizzes: comprehensions.length,
      completedQuizzes: completed.length,
      averageScore: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      totalQuestionsAnswered: completed.reduce(
        (sum, c) => sum + c.questions.filter((q) => q.userAnswer !== undefined).length,
        0
      ),
    };
  },
});

/**
 * List all comprehension quizzes for a user
 */
export const list = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let dbQuery;
    if (args.language !== undefined) {
      const lang = args.language;
      dbQuery = ctx.db
        .query("storyComprehension")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", lang)
        );
    } else {
      dbQuery = ctx.db
        .query("storyComprehension")
        .withIndex("by_user", (q) => q.eq("userId", args.userId));
    }

    return await dbQuery.order("desc").take(limit);
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new comprehension quiz for a story
 */
export const create = mutation({
  args: {
    userId: v.string(),
    storyId: v.string(),
    storyTitle: v.string(),
    language: languageValidator,
    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.union(
          v.literal("multiple_choice"),
          v.literal("translation"),
          v.literal("short_answer"),
          v.literal("inference"),
          v.literal("prediction"),
          v.literal("grammar"),
          v.literal("opinion")
        ),
        question: v.string(),
        questionTranslation: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        rubric: v.optional(v.string()),
        relatedChapter: v.optional(v.number()),
        points: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if quiz already exists for this story
    const existing = await ctx.db
      .query("storyComprehension")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const totalScore = args.questions.reduce((sum, q) => sum + q.points, 0);

    const id = await ctx.db.insert("storyComprehension", {
      userId: args.userId,
      storyId: args.storyId,
      storyTitle: args.storyTitle,
      language: args.language,
      questions: args.questions.map((q) => ({
        ...q,
        userAnswer: undefined,
        isCorrect: undefined,
        aiScore: undefined,
        aiFeedback: undefined,
        earnedPoints: undefined,
      })),
      totalScore,
      earnedScore: undefined,
      percentScore: undefined,
      completedAt: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Submit an answer to a question
 */
export const submitAnswer = mutation({
  args: {
    comprehensionId: v.id("storyComprehension"),
    questionIndex: v.number(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const comprehension = await ctx.db.get(args.comprehensionId);
    if (!comprehension) {
      throw new Error("Comprehension quiz not found");
    }

    if (args.questionIndex < 0 || args.questionIndex >= comprehension.questions.length) {
      throw new Error("Invalid question index");
    }

    const questions = [...comprehension.questions];
    const question = questions[args.questionIndex];

    // For multiple choice, auto-grade
    if (question.type === "multiple_choice" && question.correctAnswer) {
      const isCorrect = args.answer === question.correctAnswer;
      questions[args.questionIndex] = {
        ...question,
        userAnswer: args.answer,
        isCorrect,
        earnedPoints: isCorrect ? question.points : 0,
      };
    } else {
      // For short answer and essay, just save the answer (AI grading comes later)
      questions[args.questionIndex] = {
        ...question,
        userAnswer: args.answer,
      };
    }

    await ctx.db.patch(args.comprehensionId, {
      questions,
      updatedAt: Date.now(),
    });

    return questions[args.questionIndex];
  },
});

/**
 * Update AI grading results for a question
 */
export const updateGrading = mutation({
  args: {
    comprehensionId: v.id("storyComprehension"),
    questionIndex: v.number(),
    aiScore: v.number(),
    aiFeedback: v.string(),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const comprehension = await ctx.db.get(args.comprehensionId);
    if (!comprehension) {
      throw new Error("Comprehension quiz not found");
    }

    const questions = [...comprehension.questions];
    const question = questions[args.questionIndex];

    // Calculate earned points based on AI score (proportional)
    const earnedPoints = Math.round((args.aiScore / 100) * question.points);

    questions[args.questionIndex] = {
      ...question,
      aiScore: args.aiScore,
      aiFeedback: args.aiFeedback,
      isCorrect: args.isCorrect,
      earnedPoints,
    };

    await ctx.db.patch(args.comprehensionId, {
      questions,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Complete the comprehension quiz and calculate final score
 */
export const complete = mutation({
  args: {
    comprehensionId: v.id("storyComprehension"),
  },
  handler: async (ctx, args) => {
    const comprehension = await ctx.db.get(args.comprehensionId);
    if (!comprehension) {
      throw new Error("Comprehension quiz not found");
    }

    // Calculate total earned score
    const earnedScore = comprehension.questions.reduce(
      (sum, q) => sum + (q.earnedPoints ?? 0),
      0
    );
    const percentScore = Math.round((earnedScore / comprehension.totalScore) * 100);

    await ctx.db.patch(args.comprehensionId, {
      earnedScore,
      percentScore,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      earnedScore,
      totalScore: comprehension.totalScore,
      percentScore,
    };
  },
});

/**
 * Delete a comprehension quiz
 */
export const remove = mutation({
  args: {
    id: v.id("storyComprehension"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ============================================
// INTERNAL MUTATIONS (for AI actions)
// ============================================

/**
 * Internal: Create comprehension quiz from AI-generated questions
 */
export const createFromAI = internalMutation({
  args: {
    userId: v.string(),
    storyId: v.string(),
    storyTitle: v.string(),
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
    questions: v.array(
      v.object({
        questionId: v.string(),
        type: v.union(
          v.literal("multiple_choice"),
          v.literal("translation"),
          v.literal("short_answer"),
          v.literal("inference"),
          v.literal("prediction"),
          v.literal("grammar"),
          v.literal("opinion")
        ),
        question: v.string(),
        questionTranslation: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.optional(v.string()),
        rubric: v.optional(v.string()),
        relatedChapter: v.optional(v.number()),
        points: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if quiz already exists
    const existing = await ctx.db
      .query("storyComprehension")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const totalScore = args.questions.reduce((sum, q) => sum + q.points, 0);

    return await ctx.db.insert("storyComprehension", {
      userId: args.userId,
      storyId: args.storyId,
      storyTitle: args.storyTitle,
      language: args.language,
      questions: args.questions.map((q) => ({
        ...q,
        userAnswer: undefined,
        isCorrect: undefined,
        aiScore: undefined,
        aiFeedback: undefined,
        earnedPoints: undefined,
      })),
      totalScore,
      earnedScore: undefined,
      percentScore: undefined,
      completedAt: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: Update grading from AI
 */
export const updateGradingFromAI = internalMutation({
  args: {
    comprehensionId: v.id("storyComprehension"),
    questionIndex: v.number(),
    aiScore: v.number(),
    aiFeedback: v.string(),
    isCorrect: v.boolean(),
    possibleAnswer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const comprehension = await ctx.db.get(args.comprehensionId);
    if (!comprehension) {
      throw new Error("Comprehension quiz not found");
    }

    const questions = [...comprehension.questions];
    const question = questions[args.questionIndex];

    const earnedPoints = Math.round((args.aiScore / 100) * question.points);

    questions[args.questionIndex] = {
      ...question,
      aiScore: args.aiScore,
      aiFeedback: args.aiFeedback,
      isCorrect: args.isCorrect,
      earnedPoints,
      // Update correctAnswer with the AI-generated possible answer for text-based questions
      ...(args.possibleAnswer ? { correctAnswer: args.possibleAnswer } : {}),
    };

    await ctx.db.patch(args.comprehensionId, {
      questions,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Admin: Reset a comprehension quiz (delete it so a new one can be generated)
 */
export const reset = mutation({
  args: {
    comprehensionId: v.id("storyComprehension"),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Only allow admin to reset
    if (args.adminEmail !== "hiro.ayettey@gmail.com") {
      throw new Error("Unauthorized: Admin access required");
    }

    const comprehension = await ctx.db.get(args.comprehensionId);
    if (!comprehension) {
      throw new Error("Comprehension quiz not found");
    }

    // Delete the comprehension quiz
    await ctx.db.delete(args.comprehensionId);

    return { success: true };
  },
});
