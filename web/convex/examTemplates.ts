import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { examTypeValidator, languageValidator, examSectionTypeValidator } from "./schema";

// ============================================
// QUERIES
// ============================================

// Get all exam templates (optionally filtered)
export const list = query({
  args: {
    examType: v.optional(examTypeValidator),
    language: v.optional(languageValidator),
    publishedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query;

    if (args.publishedOnly) {
      query = ctx.db
        .query("examTemplates")
        .withIndex("by_published", (q) => q.eq("isPublished", true));
    } else if (args.examType) {
      const examType = args.examType;
      query = ctx.db
        .query("examTemplates")
        .withIndex("by_exam_type", (q) => q.eq("examType", examType));
    } else if (args.language) {
      const language = args.language;
      query = ctx.db
        .query("examTemplates")
        .withIndex("by_language", (q) => q.eq("language", language));
    } else {
      query = ctx.db.query("examTemplates");
    }

    const results = await query.collect();

    // Apply additional filters
    return results.filter((t) => {
      if (args.publishedOnly && !t.isPublished) return false;
      if (args.examType && t.examType !== args.examType) return false;
      if (args.language && t.language !== args.language) return false;
      return true;
    });
  },
});

// Get a single exam template by ID
export const get = query({
  args: { templateId: v.id("examTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

// Get templates for a specific exam type with question counts
export const getWithStats = query({
  args: {
    examType: examTypeValidator,
    publishedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query("examTemplates")
      .withIndex("by_exam_type", (q) => q.eq("examType", args.examType))
      .collect();

    const filtered = args.publishedOnly
      ? templates.filter((t) => t.isPublished)
      : templates;

    // Get question counts for each template
    const withStats = await Promise.all(
      filtered.map(async (template) => {
        const questions = await ctx.db
          .query("examQuestions")
          .withIndex("by_template", (q) => q.eq("templateId", template._id))
          .collect();

        return {
          ...template,
          totalQuestions: questions.length,
          sectionBreakdown: template.sections.map((section) => ({
            ...section,
            questionsAvailable: questions.filter(
              (q) => q.sectionType === section.type
            ).length,
          })),
        };
      })
    );

    return withStats;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new exam template
export const create = mutation({
  args: {
    examType: examTypeValidator,
    language: languageValidator,
    title: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    year: v.optional(v.number()),
    sections: v.array(
      v.object({
        type: examSectionTypeValidator,
        title: v.string(),
        timeLimitMinutes: v.optional(v.number()),
        questionCount: v.number(),
      })
    ),
    totalTimeLimitMinutes: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("examTemplates", {
      examType: args.examType,
      language: args.language,
      title: args.title,
      description: args.description,
      source: args.source,
      year: args.year,
      sections: args.sections,
      totalTimeLimitMinutes: args.totalTimeLimitMinutes,
      passingScore: args.passingScore,
      isPublished: args.isPublished ?? false,
      createdAt: now,
    });
  },
});

// Update an exam template
export const update = mutation({
  args: {
    templateId: v.id("examTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    year: v.optional(v.number()),
    sections: v.optional(
      v.array(
        v.object({
          type: examSectionTypeValidator,
          title: v.string(),
          timeLimitMinutes: v.optional(v.number()),
          questionCount: v.number(),
        })
      )
    ),
    totalTimeLimitMinutes: v.optional(v.number()),
    passingScore: v.optional(v.number()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { templateId, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(templateId, filteredUpdates);
    }

    return templateId;
  },
});

// Delete an exam template and its questions
export const remove = mutation({
  args: { templateId: v.id("examTemplates") },
  handler: async (ctx, args) => {
    // Delete associated questions
    const questions = await ctx.db
      .query("examQuestions")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();

    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    // Delete the template
    await ctx.db.delete(args.templateId);
  },
});

// Publish or unpublish a template
export const setPublished = mutation({
  args: {
    templateId: v.id("examTemplates"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.templateId, {
      isPublished: args.isPublished,
    });
  },
});

// Internal mutation for importing templates
export const createFromImport = internalMutation({
  args: {
    examType: examTypeValidator,
    language: languageValidator,
    title: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    year: v.optional(v.number()),
    sections: v.array(
      v.object({
        type: examSectionTypeValidator,
        title: v.string(),
        timeLimitMinutes: v.optional(v.number()),
        questionCount: v.number(),
      })
    ),
    totalTimeLimitMinutes: v.optional(v.number()),
    passingScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("examTemplates", {
      ...args,
      isPublished: false,
      createdAt: now,
    });
  },
});
