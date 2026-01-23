import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
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
      isPublished: false, // Personal decks aren't published
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
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("complete"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId));

    const items = await query.collect();

    // Filter by status if provided
    const filtered = args.status
      ? items.filter((item) => item.generationStatus === args.status)
      : items;

    return args.limit ? filtered.slice(0, args.limit) : filtered;
  },
});

// Get all vocabulary from user's subscribed decks
export const getAllSubscribedVocabulary = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user's subscriptions
    const subscriptions = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (subscriptions.length === 0) {
      return [];
    }

    // Get vocabulary for each subscribed deck
    const deckIds = subscriptions.map((s) => s.deckId);
    const allVocab = await Promise.all(
      deckIds.map(async (deckId) => {
        const items = await ctx.db
          .query("premadeVocabulary")
          .withIndex("by_deck", (q) => q.eq("deckId", deckId))
          .collect();
        return items;
      })
    );

    // Flatten and return
    return allVocab.flat();
  },
});

// Find existing generated content for a word (across all decks)
export const findExistingWordContent = query({
  args: {
    word: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    // Find any premade vocabulary with this word that has generated content
    const existing = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .filter((q) =>
        q.and(
          q.eq(q.field("word"), args.word),
          q.eq(q.field("generationStatus"), "complete")
        )
      )
      .first();

    if (!existing) return null;

    return {
      sentence: existing.sentence,
      sentenceTranslation: existing.sentenceTranslation,
      audioUrl: existing.audioUrl,
      wordAudioUrl: existing.wordAudioUrl,
      imageUrl: existing.imageUrl,
    };
  },
});

// Get generation stats for a deck
export const getDeckGenerationStats = query({
  args: {
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    return {
      total: items.length,
      pending: items.filter((i) => i.generationStatus === "pending").length,
      generating: items.filter((i) => i.generationStatus === "generating").length,
      complete: items.filter((i) => i.generationStatus === "complete").length,
      failed: items.filter((i) => i.generationStatus === "failed").length,
      withSentences: items.filter((i) => i.sentence).length,
      withAudio: items.filter((i) => i.audioUrl).length,
      withImages: items.filter((i) => i.imageUrl).length,
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

// Update deck stats (call after import or generation)
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

    await ctx.db.patch(deck._id, {
      totalWords: items.length,
      wordsWithSentences: items.filter((i) => i.sentence).length,
      wordsWithAudio: items.filter((i) => i.audioUrl).length,
      wordsWithImages: items.filter((i) => i.imageUrl).length,
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

// Link decks in sequence for auto-progression (admin)
export const setNextDeck = mutation({
  args: {
    deckId: v.string(),
    nextDeckId: v.optional(v.string()), // null to remove the link
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    // Validate next deck exists if provided
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

// Delete a deck (keeps vocabulary for reuse in other decks)
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

    // Delete the deck metadata only (vocabulary preserved for reuse)
    await ctx.db.delete(deck._id);

    return { deleted: true };
  },
});

// ============================================
// VOCABULARY MUTATIONS
// ============================================

// Import vocabulary items to a deck (bulk)
// If copyExistingContent is true, will copy generated content from other decks
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
    copyExistingContent: v.optional(v.boolean()), // Copy content from other decks if available
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
    let copiedContent = 0;

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

      // Check for existing content in other decks (if flag is set)
      let existingContent: {
        sentence?: string;
        sentenceTranslation?: string;
        audioUrl?: string;
        wordAudioUrl?: string;
        imageUrl?: string;
        generationStatus: "pending" | "complete";
      } = { generationStatus: "pending" };

      if (args.copyExistingContent) {
        const otherDeckWord = await ctx.db
          .query("premadeVocabulary")
          .withIndex("by_language", (q) => q.eq("language", deck.language))
          .filter((q) =>
            q.and(
              q.eq(q.field("word"), item.word),
              q.eq(q.field("generationStatus"), "complete")
            )
          )
          .first();

        if (otherDeckWord) {
          existingContent = {
            sentence: otherDeckWord.sentence,
            sentenceTranslation: otherDeckWord.sentenceTranslation,
            audioUrl: otherDeckWord.audioUrl,
            wordAudioUrl: otherDeckWord.wordAudioUrl,
            imageUrl: otherDeckWord.imageUrl,
            generationStatus: "complete",
          };
          copiedContent++;
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
        ...existingContent,
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

    return { imported, skipped, copiedContent };
  },
});

// ============================================
// INTERNAL MUTATIONS (for batch processing)
// ============================================

// Mark items as generating (internal)
export const markItemsGenerating = internalMutation({
  args: {
    itemIds: v.array(v.id("premadeVocabulary")),
    batchJobId: v.id("batchJobs"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.itemIds) {
      await ctx.db.patch(id, {
        generationStatus: "generating",
        batchJobId: args.batchJobId,
        updatedAt: now,
      });
    }
  },
});

// Update item by deck + word (for external scripts that don't have Convex IDs)
export const updateItemByWord = mutation({
  args: {
    deckId: v.string(),
    word: v.string(),
    sentence: v.optional(v.string()),
    sentenceTranslation: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    wordAudioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    generationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("complete"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { deckId, word, ...updates } = args;

    // Find the item by deck + word
    const item = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", deckId))
      .filter((q) => q.eq(q.field("word"), word))
      .first();

    if (!item) {
      throw new Error(`Word "${word}" not found in deck "${deckId}"`);
    }

    // Filter out undefined values
    const patchData: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patchData[key] = value;
      }
    }

    await ctx.db.patch(item._id, patchData);
    return item._id;
  },
});

// Delete a vocabulary item by word (admin)
export const deleteItemByWord = mutation({
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

// Update item with generated content
// Note: This is a regular mutation so external scripts can call it
// TODO: Add admin auth check when auth is set up
export const updateItemContent = mutation({
  args: {
    itemId: v.id("premadeVocabulary"),
    sentence: v.optional(v.string()),
    sentenceTranslation: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    wordAudioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    generationStatus: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const { itemId, ...updates } = args;
    await ctx.db.patch(itemId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Get pending items for batch (internal)
export const getPendingItemsForBatch = internalQuery({
  args: {
    deckId: v.string(),
    limit: v.number(),
    contentType: v.union(
      v.literal("sentences"),
      v.literal("audio"),
      v.literal("images")
    ),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    // Filter based on content type
    const pending = items.filter((item) => {
      if (args.contentType === "sentences") {
        return !item.sentence && item.generationStatus !== "generating";
      } else if (args.contentType === "audio") {
        return item.sentence && !item.audioUrl && item.generationStatus !== "generating";
      } else if (args.contentType === "images") {
        return item.sentence && !item.imageUrl && item.generationStatus !== "generating";
      }
      return false;
    });

    return pending.slice(0, args.limit);
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

    // Get all complete vocabulary items
    const premadeItems = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .filter((q) => q.eq(q.field("generationStatus"), "complete"))
      .collect();

    const now = Date.now();
    let imported = 0;
    let skipped = 0;

    for (const premade of premadeItems) {
      // Check if user already has this word
      const existing = await ctx.db
        .query("vocabulary")
        .withIndex("by_user_and_word", (q) =>
          q.eq("userId", args.userId).eq("word", premade.word)
        )
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
        examLevel: premade.level,
        timesReviewed: 0,
        timesCorrect: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Create flashcard with pre-generated content
      if (premade.sentence) {
        await ctx.db.insert("flashcards", {
          userId: args.userId,
          vocabularyId: vocabId,
          sentence: premade.sentence,
          sentenceTranslation: premade.sentenceTranslation ?? "",
          audioUrl: premade.audioUrl,
          wordAudioUrl: premade.wordAudioUrl,
          imageUrl: premade.imageUrl,
          state: "new",
          due: now,
          stability: 0,
          difficulty: 0.3,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          sentenceGeneratedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      imported++;
    }

    return { imported, skipped, total: premadeItems.length };
  },
});
