/**
 * Foundations Track
 *
 * A structured beginner experience for complete beginners:
 * - Daily unlocks: 5-10 new words
 * - Each word includes flashcard with audio + image + example sentence
 * - After every 10-20 words: AI-generated micro-story using only learned words
 * - Completion at ~100 words → Unlock full app experience
 */

import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { languageValidator } from "./schema";

// ============================================
// CONSTANTS
// ============================================

const FOUNDATIONS_TOTAL_WORDS = 100;
const DAILY_UNLOCK_COUNT = 10;
const WORDS_PER_STORY = 20; // Generate a micro-story every 20 words

// ============================================
// QUERIES
// ============================================

// Get foundations track status and progress
export const getProgress = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      return null;
    }

    const progress = user.foundationsProgress ?? {
      wordsUnlocked: 0,
      wordsLearned: 0,
      storiesUnlocked: 0,
    };

    // Calculate derived stats
    const isComplete = !!progress.completedAt;
    const percentComplete = Math.round((progress.wordsLearned / FOUNDATIONS_TOTAL_WORDS) * 100);
    const canUnlockMore = progress.wordsUnlocked < FOUNDATIONS_TOTAL_WORDS;
    const storiesAvailable = Math.floor(progress.wordsLearned / WORDS_PER_STORY);

    return {
      ...progress,
      isComplete,
      percentComplete,
      canUnlockMore,
      storiesAvailable,
      totalWords: FOUNDATIONS_TOTAL_WORDS,
      wordsPerStory: WORDS_PER_STORY,
    };
  },
});

// Get vocabulary items for foundations track (from user's vocabulary)
export const getVocabulary = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    unlockedOnly: v.optional(v.boolean()), // If true, only return unlocked words
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      return [];
    }

    const progress = user.foundationsProgress;
    const unlockedCount = progress?.wordsUnlocked ?? 0;

    // Get user's vocabulary for this language, ordered by creation
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    // Sort by creation time (oldest first)
    vocabulary.sort((a, b) => a.createdAt - b.createdAt);

    // If unlockedOnly, limit to unlocked words
    if (args.unlockedOnly) {
      return vocabulary.slice(0, unlockedCount);
    }

    // Return all vocabulary with an "unlocked" flag
    return vocabulary.map((item, index) => ({
      ...item,
      isUnlocked: index < unlockedCount,
      order: index,
    }));
  },
});

// Get learned words (mastery >= "learning")
export const getLearnedWords = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("masteryState"), "learning"),
          q.eq(q.field("masteryState"), "tested"),
          q.eq(q.field("masteryState"), "mastered")
        )
      )
      .collect();

    return vocabulary;
  },
});

// Get flashcards for foundations review
export const getFlashcards = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      return [];
    }

    const progress = user.foundationsProgress;
    const unlockedCount = progress?.wordsUnlocked ?? 0;

    if (unlockedCount === 0) {
      return [];
    }

    // Get user's vocabulary IDs (up to unlocked count)
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    // Sort by creation time and take unlocked
    vocabulary.sort((a, b) => a.createdAt - b.createdAt);
    const unlockedVocab = vocabulary.slice(0, unlockedCount);
    const vocabIds = new Set(unlockedVocab.map((v) => v._id.toString()));

    // Get flashcards for unlocked vocabulary
    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter to only unlocked vocabulary
    const foundationsCards = flashcards.filter((card) =>
      vocabIds.has(card.vocabularyId.toString())
    );

    // Return with vocabulary data
    const cardsWithVocab = await Promise.all(
      foundationsCards.map(async (card) => {
        const vocab = await ctx.db.get(card.vocabularyId);
        const sentence = card.sentenceId ? await ctx.db.get(card.sentenceId) : null;
        return {
          ...card,
          vocabulary: vocab,
          sentence,
        };
      })
    );

    // Sort by due date and limit
    cardsWithVocab.sort((a, b) => a.due - b.due);
    return args.limit ? cardsWithVocab.slice(0, args.limit) : cardsWithVocab;
  },
});

// Get due cards count for foundations
export const getDueCardsCount = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      return { due: 0, new: 0, total: 0 };
    }

    const progress = user.foundationsProgress;
    const unlockedCount = progress?.wordsUnlocked ?? 0;

    if (unlockedCount === 0) {
      return { due: 0, new: 0, total: 0 };
    }

    const now = Date.now();

    // Get user's vocabulary IDs (up to unlocked count)
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .collect();

    vocabulary.sort((a, b) => a.createdAt - b.createdAt);
    const unlockedVocab = vocabulary.slice(0, unlockedCount);
    const vocabIds = new Set(unlockedVocab.map((v) => v._id.toString()));

    // Get flashcards for unlocked vocabulary
    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const foundationsCards = flashcards.filter((card) =>
      vocabIds.has(card.vocabularyId.toString())
    );

    const dueCards = foundationsCards.filter((card) => card.state !== "new" && card.due <= now);
    const newCards = foundationsCards.filter((card) => card.state === "new");

    return {
      due: dueCards.length,
      new: newCards.length,
      total: foundationsCards.length,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

// Unlock the next batch of words
export const unlockWords = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const current = user.foundationsProgress ?? {
      wordsUnlocked: 0,
      wordsLearned: 0,
      storiesUnlocked: 0,
    };

    // Check if already at max
    if (current.wordsUnlocked >= FOUNDATIONS_TOTAL_WORDS) {
      return { unlocked: 0, total: current.wordsUnlocked };
    }

    // Calculate new unlocked count
    const newUnlocked = Math.min(
      FOUNDATIONS_TOTAL_WORDS,
      current.wordsUnlocked + DAILY_UNLOCK_COUNT
    );

    await ctx.db.patch(user._id, {
      foundationsProgress: {
        ...current,
        wordsUnlocked: newUnlocked,
      },
      updatedAt: Date.now(),
    });

    return {
      unlocked: newUnlocked - current.wordsUnlocked,
      total: newUnlocked,
    };
  },
});

// Mark a word as learned (called when user reviews a flashcard)
export const markWordLearned = mutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if vocabulary item exists and belongs to user
    const vocab = await ctx.db.get(args.vocabularyId);
    if (!vocab || vocab.userId !== args.userId) {
      throw new Error("Vocabulary item not found");
    }

    // Only count as learned if it wasn't already
    if (vocab.masteryState === "new") {
      const current = user.foundationsProgress ?? {
        wordsUnlocked: 0,
        wordsLearned: 0,
        storiesUnlocked: 0,
      };

      const newLearned = current.wordsLearned + 1;
      const newStoriesUnlocked = Math.floor(newLearned / WORDS_PER_STORY);

      const updatedProgress = {
        wordsUnlocked: current.wordsUnlocked,
        wordsLearned: newLearned,
        storiesUnlocked: newStoriesUnlocked,
        completedAt:
          newLearned >= FOUNDATIONS_TOTAL_WORDS && !current.completedAt
            ? Date.now()
            : current.completedAt,
      };

      await ctx.db.patch(user._id, {
        foundationsProgress: updatedProgress,
        updatedAt: Date.now(),
      });

      return {
        wordsLearned: newLearned,
        storiesUnlocked: newStoriesUnlocked,
        justCompleted: newLearned >= FOUNDATIONS_TOTAL_WORDS && !current.completedAt,
      };
    }

    return {
      wordsLearned: user.foundationsProgress?.wordsLearned ?? 0,
      storiesUnlocked: user.foundationsProgress?.storiesUnlocked ?? 0,
      justCompleted: false,
    };
  },
});

// Complete foundations and unlock full app
export const completeFoundations = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const current = user.foundationsProgress ?? {
      wordsUnlocked: 0,
      wordsLearned: 0,
      storiesUnlocked: 0,
    };

    // Mark as complete even if not at 100 words (allow early completion)
    await ctx.db.patch(user._id, {
      foundationsProgress: {
        ...current,
        completedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return { completed: true };
  },
});

// Reset foundations progress (for testing or user request)
export const resetProgress = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      foundationsProgress: {
        wordsUnlocked: 0,
        wordsLearned: 0,
        storiesUnlocked: 0,
      },
      updatedAt: Date.now(),
    });

    return { reset: true };
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

// Initialize foundations vocabulary for a new user
// This creates the first batch of vocabulary from a starter list
export const initializeFoundationsVocabulary = internalMutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    // Check if user already has foundations vocabulary
    const existingVocab = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) =>
        q.eq("userId", args.userId).eq("language", args.language)
      )
      .first();

    if (existingVocab) {
      // User already has vocabulary, skip initialization
      return { initialized: false, reason: "already_has_vocabulary" };
    }

    // In a full implementation, we would:
    // 1. Get the beginner deck for this language (e.g., jlpt_n5)
    // 2. Copy the first 100 words to user's vocabulary
    // 3. Create flashcards for each word
    //
    // For now, we'll defer to the deck subscription system
    return { initialized: false, reason: "use_deck_subscription" };
  },
});
