import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("readingProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Update reading progress
export const update = mutation({
  args: {
    userId: v.string(),
    storyId: v.string(),
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
        lastReadAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("readingProgress", {
      ...args,
      lastReadAt: Date.now(),
    });
  },
});

// Mark story as completed
export const markCompleted = mutation({
  args: { userId: v.string(), storyId: v.string() },
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
