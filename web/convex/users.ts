import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { languageValidator, examTypeValidator } from "./schema";

// ============================================
// QUERIES
// ============================================

// Get user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Get user by ID
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create or update user (upsert)
export const upsert = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    languages: v.optional(v.array(languageValidator)),
    targetExams: v.optional(v.array(examTypeValidator)),
    primaryLanguage: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      // Update existing user
      const updates: Record<string, unknown> = { updatedAt: now };
      if (args.email !== undefined) updates.email = args.email;
      if (args.name !== undefined) updates.name = args.name;
      if (args.languages !== undefined) updates.languages = args.languages;
      if (args.targetExams !== undefined) updates.targetExams = args.targetExams;
      if (args.primaryLanguage !== undefined) updates.primaryLanguage = args.primaryLanguage;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // Create new user with defaults
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      languages: args.languages ?? ["japanese"],
      targetExams: args.targetExams ?? [],
      primaryLanguage: args.primaryLanguage ?? "japanese",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update user languages
export const updateLanguages = mutation({
  args: {
    clerkId: v.string(),
    languages: v.array(languageValidator),
    primaryLanguage: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // If primary language is set and not in the new languages list, reset it
    let primaryLanguage = args.primaryLanguage ?? user.primaryLanguage;
    if (primaryLanguage && !args.languages.includes(primaryLanguage)) {
      primaryLanguage = args.languages[0];
    }

    await ctx.db.patch(user._id, {
      languages: args.languages,
      primaryLanguage,
      updatedAt: Date.now(),
    });
  },
});

// Update target exams
export const updateTargetExams = mutation({
  args: {
    clerkId: v.string(),
    targetExams: v.array(examTypeValidator),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      targetExams: args.targetExams,
      updatedAt: Date.now(),
    });
  },
});

// Set primary language
export const setPrimaryLanguage = mutation({
  args: {
    clerkId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Ensure language is in user's languages list
    if (!user.languages.includes(args.language)) {
      throw new Error("Language not in user's language list");
    }

    await ctx.db.patch(user._id, {
      primaryLanguage: args.language,
      updatedAt: Date.now(),
    });
  },
});

// Delete user and all associated data
export const deleteUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return;

    // Delete all user's vocabulary
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const item of vocabulary) {
      await ctx.db.delete(item._id);
    }

    // Delete all user's flashcards
    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const card of flashcards) {
      await ctx.db.delete(card._id);
    }

    // Delete flashcard reviews
    const reviews = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const review of reviews) {
      await ctx.db.delete(review._id);
    }

    // Delete user sentences
    const sentences = await ctx.db
      .query("userSentences")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const sentence of sentences) {
      await ctx.db.delete(sentence._id);
    }

    // Delete reading progress
    const progress = await ctx.db
      .query("readingProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    // Delete settings
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .first();
    if (settings) {
      await ctx.db.delete(settings._id);
    }

    // Delete subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .first();
    if (subscription) {
      await ctx.db.delete(subscription._id);
    }

    // Delete usage records
    const usageRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const record of usageRecords) {
      await ctx.db.delete(record._id);
    }

    // Delete mock tests
    const mockTests = await ctx.db
      .query("mockTests")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .collect();
    for (const test of mockTests) {
      await ctx.db.delete(test._id);
    }

    // Finally delete the user
    await ctx.db.delete(user._id);
  },
});
