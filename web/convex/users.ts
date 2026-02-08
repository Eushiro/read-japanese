import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  findUserByClerkId,
  getTodayString,
  getYesterdayString,
  requireUserByClerkId,
} from "./lib/helpers";
import { examTypeValidator, languageValidator, learningGoalValidator } from "./schema";

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
    learningGoal: v.optional(learningGoalValidator),
    interests: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await findUserByClerkId(ctx, args.clerkId);

    if (existing) {
      // Update existing user
      const updates: Record<string, unknown> = { updatedAt: now };
      if (args.email !== undefined) updates.email = args.email;
      if (args.name !== undefined) updates.name = args.name;
      if (args.languages !== undefined) updates.languages = args.languages;
      if (args.targetExams !== undefined) updates.targetExams = args.targetExams;
      if (args.learningGoal !== undefined) updates.learningGoal = args.learningGoal;
      if (args.interests !== undefined) updates.interests = args.interests;

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
      learningGoal: args.learningGoal,
      interests: args.interests,
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
  },
  handler: async (ctx, args) => {
    const user = await requireUserByClerkId(ctx, args.clerkId);

    await ctx.db.patch(user._id, {
      languages: args.languages,
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
    const user = await requireUserByClerkId(ctx, args.clerkId);

    await ctx.db.patch(user._id, {
      targetExams: args.targetExams,
      updatedAt: Date.now(),
    });
  },
});

// Update learning goal
export const updateLearningGoal = mutation({
  args: {
    clerkId: v.string(),
    learningGoal: learningGoalValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUserByClerkId(ctx, args.clerkId);

    await ctx.db.patch(user._id, {
      learningGoal: args.learningGoal,
      updatedAt: Date.now(),
    });
  },
});

// Update user interests
export const updateInterests = mutation({
  args: {
    clerkId: v.string(),
    interests: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserByClerkId(ctx, args.clerkId);

    await ctx.db.patch(user._id, {
      interests: args.interests,
      updatedAt: Date.now(),
    });
  },
});

// Update proficiency level (admin override or placement test result)
export const updateProficiencyLevel = mutation({
  args: {
    clerkId: v.string(),
    language: languageValidator,
    level: v.string(), // "N5", "N4", etc. or "A1", "B2", etc.
  },
  handler: async (ctx, args) => {
    const user = await requireUserByClerkId(ctx, args.clerkId);

    // Build the proficiency levels object
    const currentLevels = user.proficiencyLevels ?? {};
    const updatedLevels = {
      ...currentLevels,
      [args.language]: {
        level: args.level,
        assessedAt: Date.now(),
        // No testId since this is a manual override
      },
    };

    await ctx.db.patch(user._id, {
      proficiencyLevels: updatedLevels,
      updatedAt: Date.now(),
    });
  },
});

// Update streak on session completion
export const updateStreak = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUserByClerkId(ctx, args.clerkId);

    const todayStr = getTodayString();
    const yesterdayStr = getYesterdayString();
    const lastActivity = user.lastActivityDate;
    const currentStreak = user.currentStreak ?? 0;
    const longestStreak = user.longestStreak ?? 0;

    let newStreak = 1;

    if (lastActivity) {
      // Check if already active today (no streak change)
      if (lastActivity === todayStr) {
        return {
          currentStreak,
          longestStreak,
          streakUpdated: false,
        };
      }

      // Check if yesterday (streak continues)
      if (lastActivity === yesterdayStr) {
        newStreak = currentStreak + 1;
      }
      // Otherwise streak resets to 1
    }

    const newLongestStreak = Math.max(longestStreak, newStreak);

    await ctx.db.patch(user._id, {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: todayStr,
      updatedAt: Date.now(),
    });

    return {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      streakUpdated: true,
      isNewRecord: newStreak > longestStreak,
    };
  },
});

// Get streak info
export const getStreak = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByClerkId(ctx, args.clerkId);
    if (!user) return null;

    const todayStr = getTodayString();
    const yesterdayStr = getYesterdayString();
    const lastActivity = user.lastActivityDate;
    const currentStreak = user.currentStreak ?? 0;

    // Check if streak is still active
    let isStreakActive = false;
    if (lastActivity === todayStr) {
      isStreakActive = true;
    } else if (lastActivity) {
      isStreakActive = lastActivity === yesterdayStr;
    }

    return {
      currentStreak: isStreakActive ? currentStreak : 0,
      longestStreak: user.longestStreak ?? 0,
      lastActivityDate: lastActivity,
      hasActivityToday: lastActivity === todayStr,
    };
  },
});

// Delete user and all associated data
export const deleteUser = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByClerkId(ctx, args.clerkId);
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

    // Delete user preferences (consolidated settings table)
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .first();
    if (prefs) {
      await ctx.db.delete(prefs._id);
    }

    // Delete subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.clerkId))
      .first();
    if (subscription) {
      await ctx.db.delete(subscription._id);
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
