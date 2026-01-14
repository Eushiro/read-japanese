import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all vocabulary items for a user
export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Add a word to vocabulary
export const add = mutation({
  args: {
    userId: v.string(),
    word: v.string(),
    reading: v.string(),
    meaning: v.string(),
    jlptLevel: v.optional(v.string()),
    partOfSpeech: v.optional(v.string()),
    sourceStoryId: v.optional(v.string()),
    sourceStoryTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if word already exists for this user
    const existing = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_word", (q) =>
        q.eq("userId", args.userId).eq("word", args.word)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("vocabulary", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Remove a word from vocabulary
export const remove = mutation({
  args: { id: v.id("vocabulary") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Check if a word is saved
export const isSaved = query({
  args: { userId: v.string(), word: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_word", (q) =>
        q.eq("userId", args.userId).eq("word", args.word)
      )
      .first();
    return item !== null;
  },
});

// Get a vocabulary item by word (returns item with ID for removal)
export const getByWord = query({
  args: { userId: v.string(), word: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_word", (q) =>
        q.eq("userId", args.userId).eq("word", args.word)
      )
      .first();
  },
});
