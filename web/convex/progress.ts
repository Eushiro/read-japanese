import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { languageValidator } from "./schema";

// Get reading progress for a specific story
export const get = query({
  args: { userId: v.string(), storyId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("readingProgress")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();
  },
});

// Get all reading progress for a user
export const listAll = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    if (args.language) {
      return await ctx.db
        .query("readingProgress")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    }

    return await ctx.db
      .query("readingProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get progress stats
export const getStats = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    let progress;
    if (args.language) {
      progress = await ctx.db
        .query("readingProgress")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    } else {
      progress = await ctx.db
        .query("readingProgress")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    return {
      totalStories: progress.length,
      completedStories: progress.filter((p) => p.isCompleted).length,
      inProgressStories: progress.filter((p) => !p.isCompleted && p.percentComplete > 0).length,
      averageProgress: progress.length > 0
        ? Math.round(progress.reduce((sum, p) => sum + p.percentComplete, 0) / progress.length)
        : 0,
    };
  },
});

// Update reading progress
export const update = mutation({
  args: {
    userId: v.string(),
    storyId: v.string(),
    language: v.optional(languageValidator),
    currentChapterIndex: v.number(),
    currentSegmentIndex: v.number(),
    percentComplete: v.number(),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("readingProgress")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currentChapterIndex: args.currentChapterIndex,
        currentSegmentIndex: args.currentSegmentIndex,
        percentComplete: args.percentComplete,
        isCompleted: args.isCompleted,
        language: args.language,
        lastReadAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("readingProgress", {
      userId: args.userId,
      storyId: args.storyId,
      language: args.language,
      currentChapterIndex: args.currentChapterIndex,
      currentSegmentIndex: args.currentSegmentIndex,
      percentComplete: args.percentComplete,
      isCompleted: args.isCompleted,
      lastReadAt: Date.now(),
    });
  },
});

// Mark story as completed
export const markCompleted = mutation({
  args: {
    userId: v.string(),
    storyId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("readingProgress")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isCompleted: true,
        percentComplete: 100,
        lastReadAt: Date.now(),
      });
    } else {
      await ctx.db.insert("readingProgress", {
        userId: args.userId,
        storyId: args.storyId,
        language: args.language,
        currentChapterIndex: 0,
        currentSegmentIndex: 0,
        percentComplete: 100,
        isCompleted: true,
        lastReadAt: Date.now(),
      });
    }
  },
});

// Reset progress
export const reset = mutation({
  args: { userId: v.string(), storyId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("readingProgress")
      .withIndex("by_user_and_story", (q) =>
        q.eq("userId", args.userId).eq("storyId", args.storyId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Get recently read stories
export const getRecent = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("readingProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by lastReadAt descending and take limit
    return progress
      .sort((a, b) => b.lastReadAt - a.lastReadAt)
      .slice(0, args.limit ?? 10);
  },
});
