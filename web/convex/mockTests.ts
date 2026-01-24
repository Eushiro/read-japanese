import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { languageValidator, examTypeValidator } from "./schema";

// Question type validator
const questionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("short_answer"),
  v.literal("essay")
);

// Section type validator
const sectionTypeValidator = v.union(
  v.literal("reading"),
  v.literal("listening"),
  v.literal("writing"),
  v.literal("vocabulary")
);

// ============================================
// QUERIES
// ============================================

// Get all mock tests for a user
export const list = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    examType: v.optional(examTypeValidator),
  },
  handler: async (ctx, args) => {
    if (args.examType) {
      return await ctx.db
        .query("mockTests")
        .withIndex("by_user_and_exam", (q) =>
          q.eq("userId", args.userId).eq("examType", args.examType!)
        )
        .order("desc")
        .collect();
    }

    if (args.language) {
      return await ctx.db
        .query("mockTests")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("mockTests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a specific mock test
export const getById = query({
  args: { id: v.id("mockTests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get mock test stats
export const getStats = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    examType: v.optional(examTypeValidator),
  },
  handler: async (ctx, args) => {
    let tests;
    if (args.examType) {
      tests = await ctx.db
        .query("mockTests")
        .withIndex("by_user_and_exam", (q) =>
          q.eq("userId", args.userId).eq("examType", args.examType!)
        )
        .collect();
    } else if (args.language) {
      tests = await ctx.db
        .query("mockTests")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    } else {
      tests = await ctx.db
        .query("mockTests")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const completedTests = tests.filter((t) => t.completedAt);
    const scores = completedTests.map((t) => t.percentScore ?? 0);

    return {
      totalTests: tests.length,
      completedTests: completedTests.length,
      inProgressTests: tests.filter((t) => t.startedAt && !t.completedAt).length,
      averageScore: scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      byExamType: {} as Record<string, { count: number; avgScore: number }>,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new mock test
export const create = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    examType: examTypeValidator,
    title: v.string(),
    sections: v.array(
      v.object({
        type: sectionTypeValidator,
        title: v.string(),
        content: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        questions: v.array(
          v.object({
            question: v.string(),
            type: questionTypeValidator,
            options: v.optional(v.array(v.string())),
            correctAnswer: v.optional(v.string()),
            points: v.number(),
          })
        ),
      })
    ),
    timeLimitMinutes: v.optional(v.number()),
    targetedVocabularyIds: v.optional(v.array(v.id("vocabulary"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Calculate total points
    const totalPoints = args.sections.reduce(
      (sum, section) =>
        sum + section.questions.reduce((qSum, q) => qSum + q.points, 0),
      0
    );

    return await ctx.db.insert("mockTests", {
      userId: args.userId,
      language: args.language,
      examType: args.examType,
      title: args.title,
      sections: args.sections.map((section) => ({
        ...section,
        questions: section.questions.map((q) => ({
          ...q,
          userAnswer: undefined,
          isCorrect: undefined,
          earnedPoints: undefined,
          feedback: undefined,
        })),
      })),
      totalPoints,
      timeLimitMinutes: args.timeLimitMinutes,
      targetedVocabularyIds: args.targetedVocabularyIds,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Start a mock test
export const start = mutation({
  args: { testId: v.id("mockTests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testId, {
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Submit an answer
export const submitAnswer = mutation({
  args: {
    testId: v.id("mockTests"),
    sectionIndex: v.number(),
    questionIndex: v.number(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) throw new Error("Test not found");

    const sections = [...test.sections];
    const section = sections[args.sectionIndex];
    if (!section) throw new Error("Section not found");

    const question = section.questions[args.questionIndex];
    if (!question) throw new Error("Question not found");

    // Update the answer
    section.questions[args.questionIndex] = {
      ...question,
      userAnswer: args.answer,
    };

    sections[args.sectionIndex] = section;

    await ctx.db.patch(args.testId, {
      sections,
      updatedAt: Date.now(),
    });
  },
});

// Grade the test (for multiple choice - auto grade)
export const grade = mutation({
  args: { testId: v.id("mockTests") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) throw new Error("Test not found");

    let earnedPoints = 0;
    let totalQuestions = 0;
    let correctQuestions = 0;

    // Track section scores for learner model
    const sectionScores: Record<string, { earned: number; total: number }> = {};

    const sections = test.sections.map((section) => {
      let sectionEarned = 0;
      let sectionTotal = 0;

      const gradedQuestions = section.questions.map((question) => {
        let isCorrect = false;
        let earned = 0;
        totalQuestions++;
        sectionTotal += question.points;

        if (question.type === "multiple_choice" && question.correctAnswer) {
          isCorrect = question.userAnswer === question.correctAnswer;
          earned = isCorrect ? question.points : 0;
          earnedPoints += earned;
          sectionEarned += earned;
          if (isCorrect) correctQuestions++;
        } else if (question.type === "short_answer" && question.correctAnswer) {
          // Simple string comparison for short answers
          isCorrect =
            question.userAnswer?.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim();
          earned = isCorrect ? question.points : 0;
          earnedPoints += earned;
          sectionEarned += earned;
          if (isCorrect) correctQuestions++;
        }
        // Essay questions need manual/AI grading

        return {
          ...question,
          isCorrect,
          earnedPoints: earned,
        };
      });

      sectionScores[section.type] = { earned: sectionEarned, total: sectionTotal };

      return {
        ...section,
        questions: gradedQuestions,
      };
    });

    const percentScore = Math.round((earnedPoints / test.totalPoints) * 100);

    await ctx.db.patch(args.testId, {
      sections,
      earnedPoints,
      percentScore,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update learner profile with exam results
    const sectionScoresForProfile: {
      reading?: number;
      listening?: number;
      vocabulary?: number;
      grammar?: number;
      writing?: number;
    } = {};

    for (const [sectionType, scores] of Object.entries(sectionScores)) {
      if (scores.total > 0) {
        const sectionPercent = Math.round((scores.earned / scores.total) * 100);
        if (sectionType === "reading") sectionScoresForProfile.reading = sectionPercent;
        else if (sectionType === "listening") sectionScoresForProfile.listening = sectionPercent;
        else if (sectionType === "vocabulary") sectionScoresForProfile.vocabulary = sectionPercent;
        else if (sectionType === "writing") sectionScoresForProfile.writing = sectionPercent;
      }
    }

    await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromExamInternal, {
      userId: test.userId,
      language: test.language,
      sectionScores: sectionScoresForProfile,
      questionsAnswered: totalQuestions,
      questionsCorrect: correctQuestions,
    });

    return { earnedPoints, totalPoints: test.totalPoints, percentScore };
  },
});

// Update question feedback (for AI-graded essays)
export const updateQuestionFeedback = mutation({
  args: {
    testId: v.id("mockTests"),
    sectionIndex: v.number(),
    questionIndex: v.number(),
    isCorrect: v.boolean(),
    earnedPoints: v.number(),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test) throw new Error("Test not found");

    const sections = [...test.sections];
    const section = sections[args.sectionIndex];
    if (!section) throw new Error("Section not found");

    const question = section.questions[args.questionIndex];
    if (!question) throw new Error("Question not found");

    section.questions[args.questionIndex] = {
      ...question,
      isCorrect: args.isCorrect,
      earnedPoints: args.earnedPoints,
      feedback: args.feedback,
    };

    sections[args.sectionIndex] = section;

    // Recalculate total earned points
    let earnedPoints = 0;
    for (const s of sections) {
      for (const q of s.questions) {
        earnedPoints += q.earnedPoints ?? 0;
      }
    }
    const percentScore = Math.round((earnedPoints / test.totalPoints) * 100);

    await ctx.db.patch(args.testId, {
      sections,
      earnedPoints,
      percentScore,
      updatedAt: Date.now(),
    });
  },
});

// Delete a mock test
export const remove = mutation({
  args: { testId: v.id("mockTests") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.testId);
  },
});

// Get incomplete tests
export const getIncomplete = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("mockTests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return tests.filter((t) => t.startedAt && !t.completedAt);
  },
});
