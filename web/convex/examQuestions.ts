import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import {
  examTypeValidator,
  languageValidator,
  examSectionTypeValidator,
  examQuestionTypeValidator,
} from "./schema";

// ============================================
// QUERIES
// ============================================

// Get all questions for a template
export const getByTemplate = query({
  args: { templateId: v.id("examTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("examQuestions")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();
  },
});

// Get questions by exam type and section
export const getByExamSection = query({
  args: {
    examType: examTypeValidator,
    sectionType: examSectionTypeValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("examQuestions")
      .withIndex("by_exam_section", (q) =>
        q.eq("examType", args.examType).eq("sectionType", args.sectionType)
      )
      .collect();

    if (args.limit) {
      return questions.slice(0, args.limit);
    }

    return questions;
  },
});

// Get a single question by ID
export const get = query({
  args: { questionId: v.id("examQuestions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.questionId);
  },
});

// Get random questions for an exam section
export const getRandomForSection = query({
  args: {
    examType: examTypeValidator,
    sectionType: examSectionTypeValidator,
    count: v.number(),
    excludeIds: v.optional(v.array(v.id("examQuestions"))),
  },
  handler: async (ctx, args) => {
    const allQuestions = await ctx.db
      .query("examQuestions")
      .withIndex("by_exam_section", (q) =>
        q.eq("examType", args.examType).eq("sectionType", args.sectionType)
      )
      .collect();

    // Filter out excluded questions
    const available = args.excludeIds
      ? allQuestions.filter((q) => !args.excludeIds!.includes(q._id))
      : allQuestions;

    // Shuffle and take requested count
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, args.count);
  },
});

// Get question count by section
export const getCountBySection = query({
  args: {
    examType: examTypeValidator,
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("examQuestions")
      .filter((q) => q.eq(q.field("examType"), args.examType))
      .collect();

    const counts: Record<string, number> = {};
    for (const q of questions) {
      counts[q.sectionType] = (counts[q.sectionType] || 0) + 1;
    }

    return counts;
  },
});

// Internal query for getting questions
export const getByTemplateInternal = internalQuery({
  args: { templateId: v.id("examTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("examQuestions")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new question
export const create = mutation({
  args: {
    templateId: v.optional(v.id("examTemplates")),
    examType: examTypeValidator,
    language: languageValidator,
    sectionType: examSectionTypeValidator,
    questionText: v.string(),
    passageText: v.optional(v.string()),
    passageAudioUrl: v.optional(v.string()),
    questionType: examQuestionTypeValidator,
    options: v.optional(v.array(v.string())),
    correctAnswer: v.string(),
    acceptableAnswers: v.optional(v.array(v.string())),
    explanation: v.optional(v.string()),
    rubric: v.optional(v.string()),
    difficulty: v.optional(v.number()),
    points: v.number(),
    source: v.optional(v.string()),
    topicIds: v.optional(v.array(v.id("topicTaxonomy"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("examQuestions", {
      ...args,
      createdAt: now,
    });
  },
});

// Create multiple questions in batch
export const createBatch = mutation({
  args: {
    questions: v.array(
      v.object({
        templateId: v.optional(v.id("examTemplates")),
        examType: examTypeValidator,
        language: languageValidator,
        sectionType: examSectionTypeValidator,
        questionText: v.string(),
        passageText: v.optional(v.string()),
        passageAudioUrl: v.optional(v.string()),
        questionType: examQuestionTypeValidator,
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        acceptableAnswers: v.optional(v.array(v.string())),
        explanation: v.optional(v.string()),
        rubric: v.optional(v.string()),
        difficulty: v.optional(v.number()),
        points: v.number(),
        source: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids = [];

    for (const question of args.questions) {
      const id = await ctx.db.insert("examQuestions", {
        ...question,
        createdAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});

// Update a question
export const update = mutation({
  args: {
    questionId: v.id("examQuestions"),
    questionText: v.optional(v.string()),
    passageText: v.optional(v.string()),
    passageAudioUrl: v.optional(v.string()),
    questionType: v.optional(examQuestionTypeValidator),
    options: v.optional(v.array(v.string())),
    correctAnswer: v.optional(v.string()),
    acceptableAnswers: v.optional(v.array(v.string())),
    explanation: v.optional(v.string()),
    rubric: v.optional(v.string()),
    difficulty: v.optional(v.number()),
    points: v.optional(v.number()),
    source: v.optional(v.string()),
    topicIds: v.optional(v.array(v.id("topicTaxonomy"))),
  },
  handler: async (ctx, args) => {
    const { questionId, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(questionId, filteredUpdates);
    }

    return questionId;
  },
});

// Delete a question
export const remove = mutation({
  args: { questionId: v.id("examQuestions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.questionId);
  },
});

// Internal mutation for importing questions
export const createFromImport = internalMutation({
  args: {
    templateId: v.optional(v.id("examTemplates")),
    examType: examTypeValidator,
    language: languageValidator,
    sectionType: examSectionTypeValidator,
    questionText: v.string(),
    passageText: v.optional(v.string()),
    passageAudioUrl: v.optional(v.string()),
    questionType: examQuestionTypeValidator,
    options: v.optional(v.array(v.string())),
    correctAnswer: v.string(),
    acceptableAnswers: v.optional(v.array(v.string())),
    explanation: v.optional(v.string()),
    rubric: v.optional(v.string()),
    difficulty: v.optional(v.number()),
    points: v.number(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("examQuestions", {
      ...args,
      createdAt: now,
    });
  },
});
