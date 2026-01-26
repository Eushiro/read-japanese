import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getDefinitions, type UILanguage } from "./lib/translation";
import {
  languageValidator,
  masteryStateValidator,
  sourceTypeValidator,
  uiLanguageValidator,
} from "./schema";

// ============================================
// QUERIES
// ============================================

// Get all vocabulary items for a user
export const list = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    if (args.language) {
      return await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get vocabulary by mastery state
export const listByMastery = query({
  args: {
    userId: v.string(),
    language: languageValidator,
    masteryState: masteryStateValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user_language_mastery", (q) =>
        q
          .eq("userId", args.userId)
          .eq("language", args.language)
          .eq("masteryState", args.masteryState)
      )
      .collect();
  },
});

// Get vocabulary stats
export const getStats = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    let items;
    if (args.language) {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    } else {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const stats = {
      total: items.length,
      new: 0,
      learning: 0,
      tested: 0,
      mastered: 0,
      byLanguage: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    for (const item of items) {
      stats[item.masteryState as keyof typeof stats]++;
      stats.byLanguage[item.language] = (stats.byLanguage[item.language] ?? 0) + 1;
      stats.bySource[item.sourceType] = (stats.bySource[item.sourceType] ?? 0) + 1;
    }

    return stats;
  },
});

// Search vocabulary
export const search = query({
  args: {
    userId: v.string(),
    query: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();

    let items;
    if (args.language) {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    } else {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    return items.filter(
      (item) =>
        item.word.toLowerCase().includes(searchTerm) ||
        item.reading?.toLowerCase().includes(searchTerm) ||
        item.definitions.some((def) => def.toLowerCase().includes(searchTerm))
    );
  },
});

// Check if a word is saved
export const isSaved = query({
  args: { userId: v.string(), word: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_word", (q) => q.eq("userId", args.userId).eq("word", args.word))
      .first();
    return item !== null;
  },
});

// Get a vocabulary item by word
export const getByWord = query({
  args: { userId: v.string(), word: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_word", (q) => q.eq("userId", args.userId).eq("word", args.word))
      .first();
  },
});

// Get a vocabulary item by ID
export const getById = query({
  args: { id: v.id("vocabulary") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List vocabulary by source deck
export const listByDeck = query({
  args: {
    userId: v.string(),
    sourceDeckId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("sourceDeckId", args.sourceDeckId)
      )
      .order("desc")
      .collect();
  },
});

// Helper to resolve definitions for a vocabulary item
function resolveVocabDefinitions<
  T extends {
    definitions: string[];
    definitionTranslations?: { en: string; ja: string; fr: string; zh: string }[];
  },
>(item: T, uiLanguage: UILanguage): T & { definitions: string[] } {
  return {
    ...item,
    definitions: getDefinitions(item.definitionTranslations, item.definitions, uiLanguage),
  };
}

// List vocabulary with definitions resolved for a specific UI language
export const listResolved = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    uiLanguage: uiLanguageValidator,
  },
  handler: async (ctx, args) => {
    let items;
    if (args.language) {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .order("desc")
        .collect();
    } else {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
    }

    // Resolve definitions for the UI language
    return items.map((item) => resolveVocabDefinitions(item, args.uiLanguage));
  },
});

// Search vocabulary with definitions resolved for UI language
export const searchResolved = query({
  args: {
    userId: v.string(),
    query: v.string(),
    language: v.optional(languageValidator),
    uiLanguage: uiLanguageValidator,
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();

    let items;
    if (args.language) {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    } else {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    // Filter then resolve definitions
    const filtered = items.filter(
      (item) =>
        item.word.toLowerCase().includes(searchTerm) ||
        item.reading?.toLowerCase().includes(searchTerm) ||
        item.definitions.some((def) => def.toLowerCase().includes(searchTerm))
    );

    return filtered.map((item) => resolveVocabDefinitions(item, args.uiLanguage));
  },
});

// ============================================
// MUTATIONS
// ============================================

// Definition translation validator (used in multiple places)
const definitionTranslationValidator = v.object({
  en: v.string(),
  ja: v.string(),
  fr: v.string(),
  zh: v.string(),
});

// Add a word to vocabulary
export const add = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    // Multi-language definitions (optional - can be added later via AI translation)
    definitionTranslations: v.optional(v.array(definitionTranslationValidator)),
    partOfSpeech: v.optional(v.string()),
    sourceType: sourceTypeValidator,
    sourceStoryId: v.optional(v.string()),
    sourceStoryTitle: v.optional(v.string()),
    sourceYoutubeId: v.optional(v.string()),
    sourceContext: v.optional(v.string()), // The sentence where the word was found
    sourceDeckId: v.optional(v.string()), // Track which deck word came from
    examLevel: v.optional(v.string()),
    flashcardPending: v.optional(v.boolean()), // Set to true if AI flashcard generation is starting
  },
  handler: async (ctx, args) => {
    // Check if word already exists for this user
    const existing = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_word", (q) => q.eq("userId", args.userId).eq("word", args.word))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const vocabId = await ctx.db.insert("vocabulary", {
      userId: args.userId,
      language: args.language,
      word: args.word,
      reading: args.reading,
      definitions: args.definitions,
      definitionTranslations: args.definitionTranslations,
      partOfSpeech: args.partOfSpeech,
      masteryState: "new",
      sourceType: args.sourceType,
      sourceStoryId: args.sourceStoryId,
      sourceStoryTitle: args.sourceStoryTitle,
      sourceYoutubeId: args.sourceYoutubeId,
      sourceContext: args.sourceContext,
      sourceDeckId: args.sourceDeckId,
      examLevel: args.examLevel,
      flashcardPending: args.flashcardPending,
      timesReviewed: 0,
      timesCorrect: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Update personal deck stats if this word belongs to one
    if (args.sourceDeckId) {
      const deck = await ctx.db
        .query("premadeDecks")
        .withIndex("by_deck_id", (q) => q.eq("deckId", args.sourceDeckId!))
        .first();

      if (deck && deck.isPersonal) {
        await ctx.db.patch(deck._id, {
          totalWords: deck.totalWords + 1,
          lastUpdated: now,
        });
      }
    }

    return vocabId;
  },
});

// Bulk add vocabulary (for imports)
export const bulkAdd = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
    sourceType: sourceTypeValidator,
    items: v.array(
      v.object({
        word: v.string(),
        reading: v.optional(v.string()),
        definitions: v.array(v.string()),
        definitionTranslations: v.optional(v.array(definitionTranslationValidator)),
        partOfSpeech: v.optional(v.string()),
        examLevel: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const addedIds = [];

    for (const item of args.items) {
      // Check if word already exists
      const existing = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_word", (q) => q.eq("userId", args.userId).eq("word", item.word))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("vocabulary", {
          userId: args.userId,
          language: args.language,
          word: item.word,
          reading: item.reading,
          definitions: item.definitions,
          definitionTranslations: item.definitionTranslations,
          partOfSpeech: item.partOfSpeech,
          masteryState: "new",
          sourceType: args.sourceType,
          examLevel: item.examLevel,
          timesReviewed: 0,
          timesCorrect: 0,
          createdAt: now,
          updatedAt: now,
        });
        addedIds.push(id);
      }
    }

    return { addedCount: addedIds.length, ids: addedIds };
  },
});

// Update mastery state
export const updateMastery = mutation({
  args: {
    id: v.id("vocabulary"),
    masteryState: masteryStateValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      masteryState: args.masteryState,
      updatedAt: Date.now(),
    });
  },
});

// Update vocabulary item
export const update = mutation({
  args: {
    id: v.id("vocabulary"),
    reading: v.optional(v.string()),
    definitions: v.optional(v.array(v.string())),
    definitionTranslations: v.optional(v.array(definitionTranslationValidator)),
    partOfSpeech: v.optional(v.string()),
    examLevel: v.optional(v.string()),
    flashcardPending: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Remove a word from vocabulary
export const remove = mutation({
  args: { id: v.id("vocabulary") },
  handler: async (ctx, args) => {
    const vocab = await ctx.db.get(args.id);
    if (!vocab) return;

    // Also delete associated flashcard
    const flashcard = await ctx.db
      .query("flashcards")
      .withIndex("by_vocabulary", (q) => q.eq("vocabularyId", args.id))
      .first();

    if (flashcard) {
      await ctx.db.delete(flashcard._id);
    }

    // Handle deck-related cleanup
    if (vocab.sourceDeckId) {
      const deck = await ctx.db
        .query("premadeDecks")
        .withIndex("by_deck_id", (q) => q.eq("deckId", vocab.sourceDeckId!))
        .first();

      if (deck) {
        if (deck.isPersonal) {
          // For personal decks, just decrement the count
          await ctx.db.patch(deck._id, {
            totalWords: Math.max(0, deck.totalWords - 1),
            lastUpdated: Date.now(),
          });
        } else {
          // For premade decks, mark as skipped so it doesn't get re-added
          const sub = await ctx.db
            .query("userDeckSubscriptions")
            .withIndex("by_user_and_deck", (q) =>
              q.eq("userId", vocab.userId).eq("deckId", vocab.sourceDeckId!)
            )
            .first();

          if (sub) {
            const skippedWords = sub.skippedWords ?? [];
            if (!skippedWords.includes(vocab.word)) {
              await ctx.db.patch(sub._id, {
                skippedWords: [...skippedWords, vocab.word],
                updatedAt: Date.now(),
              });
            }
          }
        }
      }
    }

    await ctx.db.delete(args.id);
  },
});

// Record a review result (called from flashcard review)
export const recordReview = mutation({
  args: {
    id: v.id("vocabulary"),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const vocab = await ctx.db.get(args.id);
    if (!vocab) return;

    await ctx.db.patch(args.id, {
      timesReviewed: vocab.timesReviewed + 1,
      timesCorrect: vocab.timesCorrect + (args.isCorrect ? 1 : 0),
      lastReviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get vocabulary items needing review (low accuracy)
export const getNeedingReview = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let items;
    if (args.language) {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .collect();
    } else {
      items = await ctx.db
        .query("vocabulary")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    // Filter items with low accuracy (< 70%) and at least 3 reviews
    return items
      .filter((item) => {
        if (item.timesReviewed < 3) return false;
        const accuracy = item.timesCorrect / item.timesReviewed;
        return accuracy < 0.7;
      })
      .sort((a, b) => {
        const accuracyA = a.timesCorrect / a.timesReviewed;
        const accuracyB = b.timesCorrect / b.timesReviewed;
        return accuracyA - accuracyB;
      })
      .slice(0, args.limit ?? 20);
  },
});
