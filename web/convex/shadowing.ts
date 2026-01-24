import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { languageValidator } from "./schema";

// ============================================
// QUERIES
// ============================================

/**
 * Get shadowing practice stats for a user
 */
export const getStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const practices = await ctx.db
      .query("shadowingPractices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalPractices = practices.length;
    const averageScore =
      totalPractices > 0
        ? Math.round(
            practices.reduce((sum, p) => sum + p.accuracyScore, 0) / totalPractices
          )
        : 0;

    // Get recent practices (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentPractices = practices.filter((p) => p.createdAt > weekAgo);

    return {
      totalPractices,
      averageScore,
      practicesThisWeek: recentPractices.length,
      averageScoreThisWeek:
        recentPractices.length > 0
          ? Math.round(
              recentPractices.reduce((sum, p) => sum + p.accuracyScore, 0) /
                recentPractices.length
            )
          : 0,
    };
  },
});

/**
 * Get flashcards suitable for shadowing (must have sentence with audio)
 */
export const getCardsForShadowing = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter for cards that have a sentence with audio
    const cardsWithAudioPromises = cards.map(async (card) => {
      if (!card.sentenceId) return null;
      const sentence = await ctx.db.get(card.sentenceId);
      if (!sentence?.audioUrl) return null;
      return { card, sentence };
    });

    const results = await Promise.all(cardsWithAudioPromises);
    const cardsWithAudio = results.filter((r): r is { card: typeof cards[0]; sentence: NonNullable<typeof results[0]>["sentence"] } => r !== null);

    // Shuffle and take limit
    const shuffled = cardsWithAudio.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, args.limit ?? 10);

    // Fetch associated vocabulary for each card
    const cardsWithVocab = await Promise.all(
      selected.map(async ({ card, sentence }) => {
        const vocab = await ctx.db.get(card.vocabularyId);
        return {
          ...card,
          sentence: sentence.sentence,
          audioUrl: sentence.audioUrl,
          vocabulary: vocab,
        };
      })
    );

    return cardsWithVocab;
  },
});

/**
 * Get recent shadowing attempts for a specific flashcard
 */
export const getAttemptsForCard = query({
  args: {
    userId: v.string(),
    flashcardId: v.id("flashcards"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const practices = await ctx.db
      .query("shadowingPractices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("flashcardId"), args.flashcardId))
      .order("desc")
      .take(args.limit ?? 5);

    return practices;
  },
});

/**
 * Get recent shadowing practices for a user
 */
export const getRecent = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const practices = await ctx.db
      .query("shadowingPractices")
      .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 20);

    return practices;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Submit a shadowing practice result
 */
export const submit = mutation({
  args: {
    userId: v.string(),
    flashcardId: v.optional(v.id("flashcards")),
    vocabularyId: v.optional(v.id("vocabulary")),
    targetText: v.string(),
    targetLanguage: languageValidator,
    userAudioStorageId: v.optional(v.id("_storage")),
    feedbackAudioUrl: v.optional(v.string()),
    feedbackText: v.string(),
    accuracyScore: v.number(),
  },
  handler: async (ctx, args) => {
    const practiceId = await ctx.db.insert("shadowingPractices", {
      userId: args.userId,
      flashcardId: args.flashcardId,
      vocabularyId: args.vocabularyId,
      targetText: args.targetText,
      targetLanguage: args.targetLanguage,
      userAudioStorageId: args.userAudioStorageId,
      feedbackAudioUrl: args.feedbackAudioUrl,
      feedbackText: args.feedbackText,
      accuracyScore: args.accuracyScore,
      createdAt: Date.now(),
    });

    // Update learner profile with speaking practice score
    await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromShadowingInternal, {
      userId: args.userId,
      language: args.targetLanguage,
      accuracyScore: args.accuracyScore,
    });

    return practiceId;
  },
});

/**
 * Store user's recording audio and return the storage ID
 */
export const storeUserAudio = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate upload URL for client to upload audio directly
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});
