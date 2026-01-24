import { v } from "convex/values";

import { type Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { languageValidator } from "./schema";

// ============================================
// DECK QUERIES
// ============================================

// List all published decks for a language
export const listPublishedDecks = query({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("premadeDecks")
      .withIndex("by_language_and_published", (q) =>
        q.eq("language", args.language).eq("isPublished", true)
      )
      .collect();
  },
});

// Get user's personal deck (or null if doesn't exist)
export const getPersonalDeck = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("premadeDecks")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", args.userId))
      .filter((q) => q.eq(q.field("isPersonal"), true))
      .first();
  },
});

// Get or create user's personal deck
export const getOrCreatePersonalDeck = mutation({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    // Check if personal deck already exists
    const existing = await ctx.db
      .query("premadeDecks")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", args.userId))
      .filter((q) => q.eq(q.field("isPersonal"), true))
      .first();

    if (existing) {
      return existing;
    }

    // Create personal deck
    const deckId = `personal_${args.userId}`;
    const now = Date.now();

    const id = await ctx.db.insert("premadeDecks", {
      deckId,
      name: "My Words",
      description: "Words you've curated",
      language: args.language,
      level: "Mixed",
      totalWords: 0,
      wordsWithSentences: 0,
      wordsWithAudio: 0,
      wordsWithImages: 0,
      isPublished: false,
      lastUpdated: now,
      isPersonal: true,
      ownerUserId: args.userId,
    });

    return await ctx.db.get(id);
  },
});

// Get a specific deck with stats
export const getDeck = query({
  args: {
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();
  },
});

// List all decks (admin)
export const listAllDecks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("premadeDecks").collect();
  },
});

// ============================================
// VOCABULARY QUERIES
// ============================================

// Get vocabulary items for a deck
export const getVocabularyForDeck = query({
  args: {
    deckId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    return args.limit ? items.slice(0, args.limit) : items;
  },
});

// Get all vocabulary from all decks the user is subscribed to
export const getAllSubscribedVocabulary = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get all user's deck subscriptions
    const subscriptions = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (subscriptions.length === 0) {
      return [];
    }

    // Get vocabulary from all subscribed decks
    const deckIds = subscriptions.map((s) => s.deckId);
    const allVocabulary = await Promise.all(
      deckIds.map(async (deckId) => {
        return await ctx.db
          .query("premadeVocabulary")
          .withIndex("by_deck", (q) => q.eq("deckId", deckId))
          .collect();
      })
    );

    // Flatten and dedupe by word+language
    const seen = new Set<string>();
    const flattened = allVocabulary.flat().filter((item) => {
      const key = `${item.word}-${item.language}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return args.limit ? flattened.slice(0, args.limit) : flattened;
  },
});

// Get vocabulary with resolved content (sentences, images, audio)
export const getVocabularyWithContent = query({
  args: {
    deckId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const limited = args.limit ? items.slice(0, args.limit) : items;

    // Resolve content for each item
    const withContent = await Promise.all(
      limited.map(async (item) => {
        const [sentence, image, wordAudio] = await Promise.all([
          item.sentenceId ? ctx.db.get(item.sentenceId) : null,
          item.imageId ? ctx.db.get(item.imageId) : null,
          ctx.db
            .query("wordAudio")
            .withIndex("by_word_language", (q) =>
              q.eq("word", item.word).eq("language", item.language)
            )
            .first(),
        ]);

        return {
          ...item,
          sentence,
          image,
          wordAudio,
        };
      })
    );

    return withContent;
  },
});

// Get deck stats (computed from content libraries)
export const getDeckStats = query({
  args: {
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    // Check word audio availability
    const wordsWithAudio = await Promise.all(
      items.map(async (item) => {
        const audio = await ctx.db
          .query("wordAudio")
          .withIndex("by_word_language", (q) =>
            q.eq("word", item.word).eq("language", item.language)
          )
          .first();
        return audio !== null;
      })
    );

    return {
      total: items.length,
      withSentences: items.filter((i) => i.sentenceId).length,
      withImages: items.filter((i) => i.imageId).length,
      withWordAudio: wordsWithAudio.filter(Boolean).length,
    };
  },
});

// ============================================
// DECK MUTATIONS
// ============================================

// Create a new deck
export const createDeck = mutation({
  args: {
    deckId: v.string(),
    name: v.string(),
    description: v.string(),
    language: languageValidator,
    level: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if deck already exists
    const existing = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (existing) {
      throw new Error(`Deck ${args.deckId} already exists`);
    }

    return await ctx.db.insert("premadeDecks", {
      deckId: args.deckId,
      name: args.name,
      description: args.description,
      language: args.language,
      level: args.level,
      totalWords: 0,
      wordsWithSentences: 0,
      wordsWithAudio: 0,
      wordsWithImages: 0,
      isPublished: false,
      lastUpdated: now,
    });
  },
});

// Update deck stats (call after import or content generation)
export const updateDeckStats = mutation({
  args: {
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    // Check word audio availability
    const wordsWithAudio = await Promise.all(
      items.map(async (item) => {
        const audio = await ctx.db
          .query("wordAudio")
          .withIndex("by_word_language", (q) =>
            q.eq("word", item.word).eq("language", item.language)
          )
          .first();
        return audio !== null;
      })
    );

    await ctx.db.patch(deck._id, {
      totalWords: items.length,
      wordsWithSentences: items.filter((i) => i.sentenceId).length,
      wordsWithImages: items.filter((i) => i.imageId).length,
      wordsWithAudio: wordsWithAudio.filter(Boolean).length,
      lastUpdated: Date.now(),
    });
  },
});

// Publish/unpublish deck
export const setDeckPublished = mutation({
  args: {
    deckId: v.string(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    await ctx.db.patch(deck._id, {
      isPublished: args.isPublished,
      lastUpdated: Date.now(),
    });
  },
});

// Link decks in sequence for auto-progression
export const setNextDeck = mutation({
  args: {
    deckId: v.string(),
    nextDeckId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    if (args.nextDeckId) {
      const nextDeck = await ctx.db
        .query("premadeDecks")
        .withIndex("by_deck_id", (q) => q.eq("deckId", args.nextDeckId!))
        .first();

      if (!nextDeck) {
        throw new Error(`Next deck ${args.nextDeckId} not found`);
      }
    }

    await ctx.db.patch(deck._id, {
      nextDeckId: args.nextDeckId,
      lastUpdated: Date.now(),
    });
  },
});

// Delete a deck
export const deleteDeck = mutation({
  args: {
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    await ctx.db.delete(deck._id);
    return { deleted: true };
  },
});

// ============================================
// VOCABULARY MUTATIONS
// ============================================

// Import vocabulary items to a deck (bulk)
export const importVocabulary = mutation({
  args: {
    deckId: v.string(),
    items: v.array(
      v.object({
        word: v.string(),
        reading: v.optional(v.string()),
        definitions: v.array(v.string()),
        partOfSpeech: v.optional(v.string()),
      })
    ),
    linkExistingContent: v.optional(v.boolean()), // Link content from libraries if available
    difficulty: v.optional(v.number()), // Preferred difficulty for sentence lookup
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    const now = Date.now();
    let imported = 0;
    let skipped = 0;
    let linkedContent = 0;

    for (const item of args.items) {
      // Check for duplicates within this deck
      const existingInDeck = await ctx.db
        .query("premadeVocabulary")
        .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
        .filter((q) => q.eq(q.field("word"), item.word))
        .first();

      if (existingInDeck) {
        skipped++;
        continue;
      }

      // Look for existing content in libraries
      let sentenceId: Id<"sentences"> | undefined;
      let imageId: Id<"images"> | undefined;

      if (args.linkExistingContent) {
        // Find a sentence at appropriate difficulty
        const sentence = await ctx.db
          .query("sentences")
          .withIndex("by_word_language", (q) =>
            q.eq("word", item.word).eq("language", deck.language)
          )
          .filter((q) => (args.difficulty ? q.lte(q.field("difficulty"), args.difficulty) : true))
          .first();

        if (sentence) {
          sentenceId = sentence._id;
          linkedContent++;
        }

        // Find an image
        const image = await ctx.db
          .query("images")
          .withIndex("by_word_language", (q) =>
            q.eq("word", item.word).eq("language", deck.language)
          )
          .first();

        if (image) {
          imageId = image._id;
        }
      }

      await ctx.db.insert("premadeVocabulary", {
        deckId: args.deckId,
        language: deck.language,
        level: deck.level,
        word: item.word,
        reading: item.reading,
        definitions: item.definitions,
        partOfSpeech: item.partOfSpeech,
        sentenceId,
        imageId,
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    // Update deck stats
    await ctx.db.patch(deck._id, {
      totalWords: deck.totalWords + imported,
      lastUpdated: now,
    });

    return { imported, skipped, linkedContent };
  },
});

// Link a vocabulary item to content from libraries
export const linkVocabularyContent = mutation({
  args: {
    vocabularyId: v.id("premadeVocabulary"),
    sentenceId: v.optional(v.id("sentences")),
    imageId: v.optional(v.id("images")),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.vocabularyId);
    if (!item) throw new Error("Vocabulary item not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.sentenceId !== undefined) updates.sentenceId = args.sentenceId;
    if (args.imageId !== undefined) updates.imageId = args.imageId;

    await ctx.db.patch(args.vocabularyId, updates);
  },
});

// Delete a vocabulary item
export const deleteVocabularyItem = mutation({
  args: {
    deckId: v.string(),
    word: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .filter((q) => q.eq(q.field("word"), args.word))
      .first();

    if (!item) {
      throw new Error(`Item "${args.word}" not found in deck ${args.deckId}`);
    }

    await ctx.db.delete(item._id);
    return { deleted: true };
  },
});

// ============================================
// USER IMPORT (copy premade to user's vocab)
// ============================================

// Import a premade deck to user's vocabulary
export const importDeckToUser = mutation({
  args: {
    deckId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    if (!deck.isPublished) {
      throw new Error(`Deck ${args.deckId} is not available`);
    }

    // Get vocabulary items that have a sentence
    const premadeItems = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .filter((q) => q.neq(q.field("sentenceId"), undefined))
      .collect();

    const now = Date.now();
    let imported = 0;
    let skipped = 0;

    for (const premade of premadeItems) {
      // Check if user already has this word
      const existing = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_word", (q) => q.eq("userId", args.userId).eq("word", premade.word))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      // Create vocabulary entry
      const vocabId = await ctx.db.insert("vocabulary", {
        userId: args.userId,
        language: premade.language,
        word: premade.word,
        reading: premade.reading,
        definitions: premade.definitions,
        partOfSpeech: premade.partOfSpeech,
        masteryState: "new",
        sourceType: "import",
        sourceDeckId: args.deckId,
        examLevel: premade.level,
        timesReviewed: 0,
        timesCorrect: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Create flashcard referencing content libraries
      if (premade.sentenceId) {
        await ctx.db.insert("flashcards", {
          userId: args.userId,
          vocabularyId: vocabId,
          sentenceId: premade.sentenceId,
          imageId: premade.imageId,
          state: "new",
          due: now,
          stability: 0,
          difficulty: 0.3,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      imported++;
    }

    return { imported, skipped, total: premadeItems.length };
  },
});

// ============================================
// CONTENT GENERATION HELPERS
// ============================================

// Get items that need sentences generated
export const getItemsNeedingSentences = query({
  args: {
    deckId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .filter((q) => q.eq(q.field("sentenceId"), undefined))
      .take(args.limit);

    return items;
  },
});

// Get words that need audio generated
export const getWordsNeedingAudio = query({
  args: {
    language: languageValidator,
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all unique words from sentences that don't have word audio
    const sentences = await ctx.db
      .query("sentences")
      .withIndex("by_word_language")
      .filter((q) => q.eq(q.field("language"), args.language))
      .collect();

    const uniqueWords = [...new Set(sentences.map((s) => s.word))];

    const needsAudio: string[] = [];
    for (const word of uniqueWords) {
      if (needsAudio.length >= args.limit) break;

      const audio = await ctx.db
        .query("wordAudio")
        .withIndex("by_word_language", (q) => q.eq("word", word).eq("language", args.language))
        .first();

      if (!audio) {
        needsAudio.push(word);
      }
    }

    return needsAudio;
  },
});

// Get sentences that need audio generated
export const getSentencesNeedingAudio = query({
  args: {
    language: languageValidator,
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const sentences = await ctx.db
      .query("sentences")
      .withIndex("by_word_language")
      .filter((q) =>
        q.and(q.eq(q.field("language"), args.language), q.eq(q.field("audioUrl"), undefined))
      )
      .take(args.limit);

    return sentences;
  },
});
