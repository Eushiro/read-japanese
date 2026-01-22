import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ============================================
// SENTENCE REFRESH JOB
// ============================================

// Get flashcards that need sentence refresh
export const getFlashcardsNeedingRefresh = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = args.limit ?? 50;

    // Get all flashcards where nextRefreshAt is in the past
    const allFlashcards = await ctx.db.query("flashcards").collect();

    const needsRefresh = allFlashcards
      .filter((card) => card.nextRefreshAt && card.nextRefreshAt <= now)
      .slice(0, limit);

    // Get vocabulary for each flashcard
    const flashcardsWithVocab = await Promise.all(
      needsRefresh.map(async (card) => {
        const vocab = await ctx.db.get(card.vocabularyId);
        return { flashcard: card, vocabulary: vocab };
      })
    );

    return flashcardsWithVocab.filter((item) => item.vocabulary !== null);
  },
});

// Update a flashcard's sentence after refresh
export const updateFlashcardSentence = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    sentence: v.string(),
    sentenceTranslation: v.string(),
    refreshIntervalDays: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const nextRefreshAt = now + args.refreshIntervalDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.flashcardId, {
      sentence: args.sentence,
      sentenceTranslation: args.sentenceTranslation,
      sentenceGeneratedAt: now,
      nextRefreshAt,
      updatedAt: now,
    });
  },
});

// Main refresh job - called by cron
export const refreshDueSentences = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get flashcards needing refresh
    const flashcardsToRefresh = await ctx.runQuery(
      internal.scheduledJobs.getFlashcardsNeedingRefresh,
      { limit: 20 } // Process in batches to avoid timeout
    );

    if (flashcardsToRefresh.length === 0) {
      console.log("No flashcards need sentence refresh");
      return { refreshed: 0 };
    }

    console.log(`Refreshing sentences for ${flashcardsToRefresh.length} flashcards`);

    let refreshedCount = 0;

    for (const { flashcard, vocabulary } of flashcardsToRefresh) {
      if (!vocabulary) continue;

      try {
        // Generate new sentence using AI
        const generated = await ctx.runAction(internal.ai.generateSentenceInternal, {
          word: vocabulary.word,
          reading: vocabulary.reading ?? undefined,
          definitions: vocabulary.definitions,
          language: vocabulary.language,
          examLevel: vocabulary.examLevel ?? undefined,
        });

        // Update the flashcard with new sentence
        await ctx.runMutation(internal.scheduledJobs.updateFlashcardSentence, {
          flashcardId: flashcard._id,
          sentence: generated.sentence,
          sentenceTranslation: generated.translation,
          refreshIntervalDays: 30, // Refresh again in 30 days
        });

        refreshedCount++;
      } catch (error) {
        console.error(`Failed to refresh flashcard ${flashcard._id}:`, error);
      }
    }

    console.log(`Successfully refreshed ${refreshedCount} flashcard sentences`);
    return { refreshed: refreshedCount };
  },
});
