import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { languageValidator } from "./schema";

// ============================================
// QUERIES
// ============================================

// List all user's subscribed decks with progress
export const listSubscriptions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch deck details for each subscription
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const deck = await ctx.db
          .query("premadeDecks")
          .withIndex("by_deck_id", (q) => q.eq("deckId", sub.deckId))
          .first();

        return {
          ...sub,
          deck: deck
            ? {
                name: deck.name,
                description: deck.description,
                language: deck.language,
                level: deck.level,
                totalWords: deck.totalWords,
              }
            : null,
        };
      })
    );

    return results;
  },
});

// Get available decks for a user (published, not yet subscribed)
export const getAvailableDecks = query({
  args: {
    userId: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    // Get all published decks for this language
    const publishedDecks = await ctx.db
      .query("premadeDecks")
      .withIndex("by_language_and_published", (q) =>
        q.eq("language", args.language).eq("isPublished", true)
      )
      .collect();

    // Get user's subscribed deck IDs
    const subscriptions = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const subscribedDeckIds = new Set(subscriptions.map((s) => s.deckId));

    // Return only unsubscribed decks
    return publishedDecks.filter((deck) => !subscribedDeckIds.has(deck.deckId));
  },
});

// Get the user's active subscription
export const getActiveSubscription = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const activeSub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (!activeSub) return null;

    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", activeSub.deckId))
      .first();

    return {
      ...activeSub,
      deck: deck
        ? {
            name: deck.name,
            description: deck.description,
            language: deck.language,
            level: deck.level,
            totalWords: deck.totalWords,
          }
        : null,
    };
  },
});

// Get subscription for a specific deck
export const getSubscription = query({
  args: {
    userId: v.string(),
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Subscribe to a deck (sets as active, pauses previous active)
export const subscribe = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
    dailyNewCards: v.optional(v.number()), // Default: 10
  },
  handler: async (ctx, args) => {
    const dailyNewCards = args.dailyNewCards ?? 10;

    // Check if already subscribed
    const existing = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();

    if (existing) {
      throw new Error("Already subscribed to this deck");
    }

    // Get deck info
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", args.deckId))
      .first();

    if (!deck) {
      throw new Error(`Deck ${args.deckId} not found`);
    }

    if (!deck.isPublished) {
      throw new Error("This deck is not available");
    }

    // Pause any currently active deck for this user
    const activeSub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (activeSub) {
      await ctx.db.patch(activeSub._id, {
        status: "paused",
        updatedAt: Date.now(),
      });
    }

    const now = Date.now();

    // Create the subscription
    return await ctx.db.insert("userDeckSubscriptions", {
      userId: args.userId,
      deckId: args.deckId,
      totalWordsInDeck: deck.totalWords,
      wordsAdded: 0,
      wordsStudied: 0,
      dailyNewCards,
      cardsAddedToday: 0,
      status: "active",
      subscribedAt: now,
      updatedAt: now,
    });
  },
});

// Set a deck as active (pauses previous, resumes this one)
export const setActiveDeck = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the subscription to activate
    const sub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();

    if (!sub) {
      throw new Error("Not subscribed to this deck");
    }

    if (sub.status === "completed") {
      throw new Error("This deck is already completed");
    }

    // Pause current active deck (if different)
    const activeSub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (activeSub && activeSub._id !== sub._id) {
      await ctx.db.patch(activeSub._id, {
        status: "paused",
        updatedAt: Date.now(),
      });
    }

    // Activate this deck
    await ctx.db.patch(sub._id, {
      status: "active",
      updatedAt: Date.now(),
    });
  },
});

// Unsubscribe from a deck (keeps imported words)
export const unsubscribe = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();

    if (!sub) {
      throw new Error("Not subscribed to this deck");
    }

    await ctx.db.delete(sub._id);
  },
});

// Update daily card limit
export const updateDailyLimit = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
    dailyNewCards: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.dailyNewCards < 1 || args.dailyNewCards > 50) {
      throw new Error("Daily limit must be between 1 and 50");
    }

    const sub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();

    if (!sub) {
      throw new Error("Not subscribed to this deck");
    }

    await ctx.db.patch(sub._id, {
      dailyNewCards: args.dailyNewCards,
      updatedAt: Date.now(),
    });
  },
});

// Add today's daily cards from the active deck
export const addDailyCards = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get active subscription
    const activeSub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active")
      )
      .first();

    if (!activeSub) {
      return { added: 0, reason: "no_active_deck" };
    }

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Check if already dripped today
    if (activeSub.lastDripDate === today) {
      return {
        added: 0,
        reason: "already_dripped_today",
        cardsAddedToday: activeSub.cardsAddedToday,
      };
    }

    // Get deck info
    const deck = await ctx.db
      .query("premadeDecks")
      .withIndex("by_deck_id", (q) => q.eq("deckId", activeSub.deckId))
      .first();

    if (!deck) {
      return { added: 0, reason: "deck_not_found" };
    }

    // Get all premade vocabulary for this deck that have sentences
    const allPremadeItems = await ctx.db
      .query("premadeVocabulary")
      .withIndex("by_deck", (q) => q.eq("deckId", activeSub.deckId))
      .collect();

    // Filter to items that have generated content (sentenceId)
    const premadeItems = allPremadeItems.filter((item) => item.sentenceId);

    // Get user's existing vocabulary words for this deck
    const existingVocab = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("sourceDeckId", activeSub.deckId)
      )
      .collect();

    const existingWords = new Set(existingVocab.map((v) => v.word));
    const skippedWords = new Set(activeSub.skippedWords ?? []);

    // Find words not yet added and not skipped
    const availableWords = premadeItems.filter(
      (item) => !existingWords.has(item.word) && !skippedWords.has(item.word)
    );

    // Take up to dailyNewCards
    const wordsToAdd = availableWords.slice(0, activeSub.dailyNewCards);

    if (wordsToAdd.length === 0) {
      // Deck is completed
      await ctx.db.patch(activeSub._id, {
        status: "completed",
        lastDripDate: today,
        cardsAddedToday: 0,
        updatedAt: Date.now(),
      });

      // Auto-subscribe to next deck if exists
      if (deck.nextDeckId) {
        const nextDeck = await ctx.db
          .query("premadeDecks")
          .withIndex("by_deck_id", (q) => q.eq("deckId", deck.nextDeckId!))
          .first();

        if (nextDeck && nextDeck.isPublished) {
          // Check if not already subscribed
          const existingNextSub = await ctx.db
            .query("userDeckSubscriptions")
            .withIndex("by_user_and_deck", (q) =>
              q.eq("userId", args.userId).eq("deckId", deck.nextDeckId!)
            )
            .first();

          if (!existingNextSub) {
            const now = Date.now();
            await ctx.db.insert("userDeckSubscriptions", {
              userId: args.userId,
              deckId: deck.nextDeckId!,
              totalWordsInDeck: nextDeck.totalWords,
              wordsAdded: 0,
              wordsStudied: 0,
              dailyNewCards: activeSub.dailyNewCards,
              cardsAddedToday: 0,
              status: "active",
              subscribedAt: now,
              updatedAt: now,
            });

            return {
              added: 0,
              reason: "deck_completed_next_started",
              nextDeckId: deck.nextDeckId,
            };
          }
        }
      }

      return { added: 0, reason: "deck_completed" };
    }

    const now = Date.now();

    // Add words to user's vocabulary
    for (const premade of wordsToAdd) {
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
        sourceDeckId: activeSub.deckId,
        examLevel: premade.level,
        timesReviewed: 0,
        timesCorrect: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Create flashcard with content library references
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
    }

    // Update subscription
    await ctx.db.patch(activeSub._id, {
      wordsAdded: activeSub.wordsAdded + wordsToAdd.length,
      lastDripDate: today,
      cardsAddedToday: wordsToAdd.length,
      updatedAt: now,
    });

    return {
      added: wordsToAdd.length,
      reason: "success",
      wordsAdded: activeSub.wordsAdded + wordsToAdd.length,
      totalWordsInDeck: activeSub.totalWordsInDeck,
    };
  },
});

// Mark a word as skipped (called when user deletes a word from a deck)
export const markWordSkipped = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
    word: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();

    if (!sub) {
      return; // Not subscribed, nothing to do
    }

    const skippedWords = sub.skippedWords ?? [];
    if (!skippedWords.includes(args.word)) {
      await ctx.db.patch(sub._id, {
        skippedWords: [...skippedWords, args.word],
        updatedAt: Date.now(),
      });
    }
  },
});

// Update wordsStudied count (called when user reviews a card)
export const incrementWordsStudied = mutation({
  args: {
    userId: v.string(),
    deckId: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("userDeckSubscriptions")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId)
      )
      .first();

    if (!sub) {
      return;
    }

    await ctx.db.patch(sub._id, {
      wordsStudied: sub.wordsStudied + 1,
      updatedAt: Date.now(),
    });
  },
});
