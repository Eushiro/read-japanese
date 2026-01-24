import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { examTypeValidator, languageValidator, examSectionTypeValidator } from "./schema";

// ============================================
// QUERIES
// ============================================

// Get all exam attempts for a user
export const listByUser = query({
  args: {
    userId: v.string(),
    examType: v.optional(examTypeValidator),
    status: v.optional(v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results;

    if (args.examType) {
      const examType = args.examType;
      results = await ctx.db
        .query("examAttempts")
        .withIndex("by_user_exam", (q) =>
          q.eq("userId", args.userId).eq("examType", examType)
        )
        .order("desc")
        .collect();
    } else {
      results = await ctx.db
        .query("examAttempts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
    }

    // Filter by status if specified
    if (args.status) {
      results = results.filter((a) => a.status === args.status);
    }

    // Apply limit
    if (args.limit) {
      results = results.slice(0, args.limit);
    }

    return results;
  },
});

// Get a specific exam attempt
export const get = query({
  args: { attemptId: v.id("examAttempts") },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return null;

    // Get template details
    const template = await ctx.db.get(attempt.templateId);

    // Get full question details for each question in the attempt
    const questionsWithDetails = await Promise.all(
      attempt.questions.map(async (q) => {
        const questionData = await ctx.db.get(q.questionId);
        return {
          ...q,
          questionData,
        };
      })
    );

    return {
      ...attempt,
      template,
      questionsWithDetails,
    };
  },
});

// Get in-progress attempt for a user and template
export const getInProgress = query({
  args: {
    userId: v.string(),
    templateId: v.id("examTemplates"),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .first();

    return attempts;
  },
});

// Get user's exam analytics
export const getAnalytics = query({
  args: {
    userId: v.string(),
    examType: v.optional(examTypeValidator),
  },
  handler: async (ctx, args) => {
    if (args.examType) {
      const examType = args.examType;
      return await ctx.db
        .query("examAnalytics")
        .withIndex("by_user_exam", (q) =>
          q.eq("userId", args.userId).eq("examType", examType)
        )
        .first();
    }

    return await ctx.db
      .query("examAnalytics")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Start a new exam attempt
export const start = mutation({
  args: {
    userId: v.string(),
    templateId: v.id("examTemplates"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the template
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Exam template not found");
    }

    // Check for existing in-progress attempt
    const existing = await ctx.db
      .query("examAttempts")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Get random questions for each section
    const questions: Array<{
      questionId: any;
      userAnswer?: string;
      isCorrect?: boolean;
      aiScore?: number;
      aiFeedback?: string;
      earnedPoints?: number;
      answeredAt?: number;
    }> = [];

    let totalPoints = 0;

    for (const section of template.sections) {
      const sectionQuestions = await ctx.db
        .query("examQuestions")
        .withIndex("by_exam_section", (q) =>
          q.eq("examType", template.examType).eq("sectionType", section.type)
        )
        .collect();

      // Filter by template if questions are linked
      const templateQuestions = sectionQuestions.filter(
        (q) => q.templateId === args.templateId || !q.templateId
      );

      // Shuffle and take required count
      const shuffled = templateQuestions.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, section.questionCount);

      for (const q of selected) {
        questions.push({ questionId: q._id });
        totalPoints += q.points;
      }
    }

    // Create the attempt
    return await ctx.db.insert("examAttempts", {
      userId: args.userId,
      templateId: args.templateId,
      examType: template.examType,
      language: template.language,
      status: "in_progress",
      questions,
      currentSection: 0,
      currentQuestion: 0,
      timeLimitMinutes: template.totalTimeLimitMinutes,
      startedAt: now,
      totalPoints,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Submit an answer for a question
export const submitAnswer = mutation({
  args: {
    attemptId: v.id("examAttempts"),
    questionIndex: v.number(),
    userAnswer: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    if (attempt.status !== "in_progress") {
      throw new Error("Exam is not in progress");
    }

    // Get the question details
    const questionRef = attempt.questions[args.questionIndex];
    if (!questionRef) {
      throw new Error("Question not found");
    }

    const question = await ctx.db.get(questionRef.questionId);
    if (!question) {
      throw new Error("Question data not found");
    }

    // Grade the answer
    let isCorrect = false;
    let earnedPoints = 0;
    let needsAiGrading = false;

    if (question.questionType === "multiple_choice") {
      // Simple comparison for multiple choice
      isCorrect = args.userAnswer === question.correctAnswer;
      earnedPoints = isCorrect ? question.points : 0;
    } else if (question.questionType === "short_answer" || question.questionType === "fill_blank") {
      // Check against correct answer and acceptable answers
      const normalizedAnswer = args.userAnswer.trim().toLowerCase();
      const normalizedCorrect = question.correctAnswer.trim().toLowerCase();
      const acceptableNormalized = (question.acceptableAnswers || []).map(
        (a) => a.trim().toLowerCase()
      );

      isCorrect =
        normalizedAnswer === normalizedCorrect ||
        acceptableNormalized.includes(normalizedAnswer);
      earnedPoints = isCorrect ? question.points : 0;

      // If not exact match but looks like an attempt, mark for AI grading
      if (!isCorrect && args.userAnswer.trim().length > 0) {
        needsAiGrading = true;
      }
    } else {
      // Essay, translation, etc. need AI grading
      needsAiGrading = true;
    }

    // Update the question in the attempt
    const updatedQuestions = [...attempt.questions];
    updatedQuestions[args.questionIndex] = {
      ...questionRef,
      userAnswer: args.userAnswer,
      isCorrect: needsAiGrading ? undefined : isCorrect,
      earnedPoints: needsAiGrading ? undefined : earnedPoints,
      answeredAt: now,
    };

    await ctx.db.patch(args.attemptId, {
      questions: updatedQuestions,
      updatedAt: now,
    });

    return {
      needsAiGrading,
      isCorrect: needsAiGrading ? undefined : isCorrect,
      earnedPoints: needsAiGrading ? undefined : earnedPoints,
    };
  },
});

// Update current position in the exam
export const updatePosition = mutation({
  args: {
    attemptId: v.id("examAttempts"),
    currentSection: v.number(),
    currentQuestion: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.attemptId, {
      currentSection: args.currentSection,
      currentQuestion: args.currentQuestion,
      updatedAt: now,
    });
  },
});

// Update answer with AI grading results
export const updateWithAiGrading = mutation({
  args: {
    attemptId: v.id("examAttempts"),
    questionIndex: v.number(),
    aiScore: v.number(),
    aiFeedback: v.string(),
    isCorrect: v.boolean(),
    earnedPoints: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    const updatedQuestions = [...attempt.questions];
    updatedQuestions[args.questionIndex] = {
      ...updatedQuestions[args.questionIndex],
      aiScore: args.aiScore,
      aiFeedback: args.aiFeedback,
      isCorrect: args.isCorrect,
      earnedPoints: args.earnedPoints,
    };

    await ctx.db.patch(args.attemptId, {
      questions: updatedQuestions,
      updatedAt: now,
    });
  },
});

// Complete an exam attempt
export const complete = mutation({
  args: {
    attemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    // Get the template for passing score
    const template = await ctx.db.get(attempt.templateId);

    // Calculate final scores
    let earnedPoints = 0;
    const sectionScores: Record<string, { total: number; earned: number }> = {};

    for (const q of attempt.questions) {
      if (q.earnedPoints !== undefined) {
        earnedPoints += q.earnedPoints;
      }

      // Get section type for this question
      const questionData = await ctx.db.get(q.questionId);
      if (questionData) {
        const sectionType = questionData.sectionType;
        if (!sectionScores[sectionType]) {
          sectionScores[sectionType] = { total: 0, earned: 0 };
        }
        sectionScores[sectionType].total += questionData.points;
        sectionScores[sectionType].earned += q.earnedPoints ?? 0;
      }
    }

    const percentScore = attempt.totalPoints > 0
      ? Math.round((earnedPoints / attempt.totalPoints) * 100)
      : 0;

    const passed = template?.passingScore
      ? percentScore >= template.passingScore
      : percentScore >= 60; // Default passing score

    // Calculate time spent
    const timeSpentSeconds = Math.round((now - attempt.startedAt) / 1000);

    // Format section scores for storage
    const sectionScoresArray = Object.entries(sectionScores).map(
      ([type, scores]) => ({
        sectionType: type as "reading" | "listening" | "vocabulary" | "grammar" | "writing",
        totalPoints: scores.total,
        earnedPoints: scores.earned,
        percentScore: scores.total > 0
          ? Math.round((scores.earned / scores.total) * 100)
          : 0,
      })
    );

    // Update the attempt
    await ctx.db.patch(args.attemptId, {
      status: "completed",
      completedAt: now,
      timeSpentSeconds,
      earnedPoints,
      percentScore,
      passed,
      sectionScores: sectionScoresArray,
      updatedAt: now,
    });

    // Update user analytics
    await updateAnalytics(ctx, {
      userId: attempt.userId,
      examType: attempt.examType,
      percentScore,
      sectionScores: sectionScoresArray,
    });

    return {
      earnedPoints,
      totalPoints: attempt.totalPoints,
      percentScore,
      passed,
      sectionScores: sectionScoresArray,
    };
  },
});

// Abandon an exam attempt
export const abandon = mutation({
  args: { attemptId: v.id("examAttempts") },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.attemptId, {
      status: "abandoned",
      updatedAt: now,
    });
  },
});

// Helper function to update analytics
async function updateAnalytics(
  ctx: { db: any },
  args: {
    userId: string;
    examType: string;
    percentScore: number;
    sectionScores: Array<{
      sectionType: string;
      totalPoints: number;
      earnedPoints: number;
      percentScore: number;
    }>;
  }
) {
  const now = Date.now();

  // Get existing analytics
  const existing = await ctx.db
    .query("examAnalytics")
    .withIndex("by_user_exam", (q: any) =>
      q.eq("userId", args.userId).eq("examType", args.examType)
    )
    .first();

  // Calculate section score averages
  const sectionAvgs: Record<string, number> = {};
  for (const section of args.sectionScores) {
    sectionAvgs[section.sectionType] = section.percentScore;
  }

  // Find weak areas (sections below 70%)
  const weakAreas = args.sectionScores
    .filter((s) => s.percentScore < 70)
    .map((s) => s.sectionType);

  if (existing) {
    // Update existing analytics
    const newTotalAttempts = existing.totalAttempts + 1;
    const newAverageScore = Math.round(
      (existing.averageScore * existing.totalAttempts + args.percentScore) /
        newTotalAttempts
    );
    const newHighestScore = Math.max(existing.highestScore, args.percentScore);

    // Merge section scores (weighted average)
    const mergedSections = { ...existing.sectionScores };
    for (const [section, score] of Object.entries(sectionAvgs)) {
      const currentScore = (mergedSections as any)[section];
      if (currentScore !== undefined) {
        (mergedSections as any)[section] = Math.round(
          (currentScore * existing.totalAttempts + score) / newTotalAttempts
        );
      } else {
        (mergedSections as any)[section] = score;
      }
    }

    await ctx.db.patch(existing._id, {
      totalAttempts: newTotalAttempts,
      averageScore: newAverageScore,
      highestScore: newHighestScore,
      sectionScores: mergedSections,
      weakAreas,
      lastAttemptAt: now,
      updatedAt: now,
    });
  } else {
    // Create new analytics record
    await ctx.db.insert("examAnalytics", {
      userId: args.userId,
      examType: args.examType as any,
      totalAttempts: 1,
      averageScore: args.percentScore,
      highestScore: args.percentScore,
      sectionScores: {
        reading: sectionAvgs.reading,
        listening: sectionAvgs.listening,
        vocabulary: sectionAvgs.vocabulary,
        grammar: sectionAvgs.grammar,
        writing: sectionAvgs.writing,
      },
      weakAreas,
      lastAttemptAt: now,
      updatedAt: now,
    });
  }
}
