import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ============================================
// SENTENCE REFRESH JOB
// ============================================

// Get flashcards that need sentence refresh
// Note: Sentence refresh is now handled differently with the content library
// Flashcards can have their sentences swapped from the sentence pool
export const getFlashcardsNeedingRefresh = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    // With the content library, we don't auto-refresh sentences
    // Instead, users can swap sentences from the pool
    // This is kept for backwards compatibility but will return empty
    const needsRefresh: typeof allFlashcards = [];
    const allFlashcards = await ctx.db.query("flashcards").take(0);

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
// Now creates a new sentence in the content library
export const updateFlashcardSentence = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    sentence: v.string(),
    sentenceTranslation: v.string(),
    refreshIntervalDays: v.number(), // Kept for API compatibility but not used
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const flashcard = await ctx.db.get(args.flashcardId);
    if (!flashcard) {
      throw new Error("Flashcard not found");
    }

    const vocab = await ctx.db.get(flashcard.vocabularyId);
    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    // Create new sentence in content library
    const difficultyMap: Record<string, number> = {
      N5: 1, N4: 2, N3: 3, N2: 4, N1: 5,
      A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
    };
    const difficulty = vocab.examLevel ? difficultyMap[vocab.examLevel] ?? 3 : 3;

    const sentenceId = await ctx.db.insert("sentences", {
      word: vocab.word,
      language: vocab.language,
      difficulty,
      sentence: args.sentence,
      translations: {
        en: args.sentenceTranslation,
      },
      model: "gemini-3-flash",
      createdAt: now,
    });

    await ctx.db.patch(args.flashcardId, {
      sentenceId,
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
