import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getDefinitions, getSentenceTranslation, normalizeUILanguage } from "./lib/translation";
import {
  cardStateValidator,
  languageValidator,
  ratingValidator,
  uiLanguageValidator,
} from "./schema";

// ============================================
// FSRS-inspired SRS Constants
// ============================================
const FSRS_PARAMS = {
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29,
    2.61,
  ],
  requestRetention: 0.9,
  maximumInterval: 36500, // ~100 years
  // Learning steps in minutes
  learningSteps: [1, 10],
  relearningSteps: [10],
};

// Smart Flashcard Management Constants
const DEFAULT_MAX_REVIEWS_PER_SESSION = 30;
const FORGIVENESS_OVERDUE_DAYS = 7; // Cards overdue by 7+ days get forgiveness treatment

// Rating multipliers for difficulty adjustment
const RATING_MULTIPLIERS = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateInitialDifficulty(rating: keyof typeof RATING_MULTIPLIERS): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];
  return w[4] - Math.exp(w[5] * (g - 1)) + 1;
}

function calculateInitialStability(rating: keyof typeof RATING_MULTIPLIERS): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];
  return w[g];
}

function calculateNextInterval(stability: number, requestRetention: number): number {
  return Math.min(
    Math.round(stability * 9 * (1 / requestRetention - 1)),
    FSRS_PARAMS.maximumInterval
  );
}

function calculateNextStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: keyof typeof RATING_MULTIPLIERS
): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];

  if (g === 0) {
    // Again - memory lapse
    return (
      w[11] *
      Math.pow(difficulty, -w[12]) *
      (Math.pow(stability + 1, w[13]) - 1) *
      Math.exp(w[14] * (1 - retrievability))
    );
  }

  // Good or better
  const hardPenalty = g === 1 ? w[15] : 1;
  const easyBonus = g === 3 ? w[16] : 1;

  return (
    stability *
    (1 +
      Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -w[9]) *
        (Math.exp(w[10] * (1 - retrievability)) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function calculateNextDifficulty(
  difficulty: number,
  rating: keyof typeof RATING_MULTIPLIERS
): number {
  const { w } = FSRS_PARAMS;
  const g = RATING_MULTIPLIERS[rating];
  const delta = g - 3; // -3 to 0
  return Math.max(1, Math.min(10, difficulty + w[6] * delta));
}

function calculateRetrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

// ============================================
// QUERIES
// ============================================

// Get flashcards due for review with resolved content
export const getDue = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    language: v.optional(languageValidator),
    uiLanguage: v.optional(uiLanguageValidator), // UI language for translation resolution
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = args.limit ?? 100;
    const uiLang = normalizeUILanguage(args.uiLanguage);
    let cards: Doc<"flashcards">[] = [];
    if (args.language) {
      const indexed = await ctx.db
        .query("flashcards")
        .withIndex("by_user_language_due", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!).lte("due", now)
        )
        .take(limit);

      if (indexed.length >= limit) {
        cards = indexed;
      } else {
        // Fallback to legacy cards missing language
        const legacy = await ctx.db
          .query("flashcards")
          .withIndex("by_user_and_due", (q) => q.eq("userId", args.userId).lte("due", now))
          .take(limit * 3);

        const legacyMatches = await Promise.all(
          legacy
            .filter((card) => !card.language)
            .map(async (card) => {
              const vocab = await ctx.db.get(card.vocabularyId);
              return vocab?.language === args.language ? card : null;
            })
        );

        cards = [...indexed, ...legacyMatches.filter((c) => c !== null)].slice(0, limit);
      }
    } else {
      cards = await ctx.db
        .query("flashcards")
        .withIndex("by_user_and_due", (q) => q.eq("userId", args.userId).lte("due", now))
        .take(limit);
    }

    const cardsWithContent = await Promise.all(
      cards.map(async (card) => {
        const [vocab, sentence, image] = await Promise.all([
          ctx.db.get(card.vocabularyId),
          card.sentenceId ? ctx.db.get(card.sentenceId) : null,
          card.imageId ? ctx.db.get(card.imageId) : null,
        ]);

        // Look up word audio
        const wordAudio = vocab
          ? await ctx.db
              .query("wordAudio")
              .withIndex("by_word_language", (q) =>
                q.eq("word", vocab.word).eq("language", vocab.language)
              )
              .first()
          : null;

        // Resolve translation for user's UI language - returns null if not available (NO English fallback)
        const sentenceTranslation = sentence?.translations
          ? getSentenceTranslation(sentence.translations, uiLang)
          : null;

        // Resolve vocabulary definitions for user's UI language
        const resolvedVocab = vocab
          ? {
              ...vocab,
              definitions: getDefinitions(vocab.definitionTranslations, vocab.definitions, uiLang),
            }
          : null;

        return {
          ...card,
          vocabulary: resolvedVocab,
          sentence: sentence
            ? {
                ...sentence,
                sentenceTranslation,
              }
            : null,
          image,
          wordAudio,
        };
      })
    );

    return cardsWithContent.slice(0, limit);
  },
});

// Get new cards (never reviewed) with resolved content
export const getNew = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    language: v.optional(languageValidator),
    uiLanguage: v.optional(uiLanguageValidator), // UI language for translation resolution
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const uiLang = normalizeUILanguage(args.uiLanguage);
    let cards: Doc<"flashcards">[] = [];
    if (args.language) {
      const indexed = await ctx.db
        .query("flashcards")
        .withIndex("by_user_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language!)
        )
        .filter((q) => q.eq(q.field("state"), "new"))
        .take(limit);

      if (indexed.length >= limit) {
        cards = indexed;
      } else {
        const legacy = await ctx.db
          .query("flashcards")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("state"), "new"))
          .take(limit * 3);

        const legacyMatches = await Promise.all(
          legacy
            .filter((card) => !card.language)
            .map(async (card) => {
              const vocab = await ctx.db.get(card.vocabularyId);
              return vocab?.language === args.language ? card : null;
            })
        );

        cards = [...indexed, ...legacyMatches.filter((c) => c !== null)].slice(0, limit);
      }
    } else {
      cards = await ctx.db
        .query("flashcards")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("state"), "new"))
        .take(limit);
    }

    const cardsWithContent = await Promise.all(
      cards.map(async (card) => {
        const [vocab, sentence, image] = await Promise.all([
          ctx.db.get(card.vocabularyId),
          card.sentenceId ? ctx.db.get(card.sentenceId) : null,
          card.imageId ? ctx.db.get(card.imageId) : null,
        ]);

        // Look up word audio
        const wordAudio = vocab
          ? await ctx.db
              .query("wordAudio")
              .withIndex("by_word_language", (q) =>
                q.eq("word", vocab.word).eq("language", vocab.language)
              )
              .first()
          : null;

        // Resolve translation for user's UI language - returns null if not available (NO English fallback)
        const sentenceTranslation = sentence?.translations
          ? getSentenceTranslation(sentence.translations, uiLang)
          : null;

        // Resolve vocabulary definitions for user's UI language
        const resolvedVocab = vocab
          ? {
              ...vocab,
              definitions: getDefinitions(vocab.definitionTranslations, vocab.definitions, uiLang),
            }
          : null;

        return {
          ...card,
          vocabulary: resolvedVocab,
          sentence: sentence
            ? {
                ...sentence,
                sentenceTranslation,
              }
            : null,
          image,
          wordAudio,
        };
      })
    );

    return cardsWithContent.slice(0, limit);
  },
});

// Get review stats for user
export const getStats = query({
  args: {
    userId: v.string(),
    language: v.optional(languageValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let cards: Doc<"flashcards">[] = [];
    if (args.language) {
      cards = await ctx.db
        .query("flashcards")
        .withIndex("by_user_language", (q) =>
          q.eq("userId", args.userId).eq("language", args.language)
        )
        .collect();

      if (cards.length === 0) {
        // Fallback for legacy cards missing language
        const allCards = await ctx.db
          .query("flashcards")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();

        const legacyMatches = await Promise.all(
          allCards
            .filter((card) => !card.language)
            .map(async (card) => {
              const vocab = await ctx.db.get(card.vocabularyId);
              return vocab?.language === args.language ? card : null;
            })
        );
        cards = legacyMatches.filter((c) => c !== null);
      }
    } else {
      cards = await ctx.db
        .query("flashcards")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const stats = {
      total: cards.length,
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0,
      dueNow: 0,
      dueToday: 0,
    };

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const endOfDayTimestamp = endOfDay.getTime();

    for (const card of cards) {
      stats[card.state as keyof typeof stats]++;
      if (card.due <= now) stats.dueNow++;
      if (card.due <= endOfDayTimestamp) stats.dueToday++;
    }

    return stats;
  },
});

// Get flashcard by vocabulary ID
export const getByVocabulary = query({
  args: { vocabularyId: v.id("vocabulary") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flashcards")
      .withIndex("by_vocabulary", (q) => q.eq("vocabularyId", args.vocabularyId))
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new flashcard
export const create = mutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    sentenceId: v.optional(v.id("sentences")), // Optional during migration
    imageId: v.optional(v.id("images")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if flashcard already exists for this vocabulary
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_vocabulary", (q) => q.eq("vocabularyId", args.vocabularyId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Look up vocabulary to denormalize language
    const vocab = await ctx.db.get(args.vocabularyId);

    return await ctx.db.insert("flashcards", {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      language: vocab?.language,
      sentenceId: args.sentenceId,
      imageId: args.imageId,

      // Initial SRS state
      state: "new",
      due: now, // Due immediately
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,

      createdAt: now,
      updatedAt: now,
    });
  },
});

// Review a flashcard and update SRS state
export const review = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    rating: ratingValidator,
    responseTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.flashcardId);
    if (!card) throw new Error("Flashcard not found");

    const now = Date.now();
    const rating = args.rating as keyof typeof RATING_MULTIPLIERS;
    const previousState = card.state;

    // Calculate elapsed days since last review
    const elapsedMs = card.lastReview ? now - card.lastReview : 0;
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

    let newState: "new" | "learning" | "review" | "relearning";
    let newStability: number;
    let newDifficulty: number;
    let scheduledDays: number;
    let lapses = card.lapses;

    if (card.state === "new") {
      // First review of a new card
      newDifficulty = calculateInitialDifficulty(rating);
      newStability = calculateInitialStability(rating);

      if (rating === "again") {
        newState = "learning";
        scheduledDays = FSRS_PARAMS.learningSteps[0] / (60 * 24); // Convert minutes to days
      } else if (rating === "hard") {
        newState = "learning";
        scheduledDays = FSRS_PARAMS.learningSteps[1] / (60 * 24);
      } else {
        newState = "review";
        scheduledDays = calculateNextInterval(newStability, FSRS_PARAMS.requestRetention);
      }
    } else if (card.state === "learning" || card.state === "relearning") {
      newDifficulty = card.difficulty;
      newStability = card.stability;

      if (rating === "again") {
        newState = card.state;
        scheduledDays = FSRS_PARAMS.learningSteps[0] / (60 * 24);
        if (card.state === "relearning") lapses++;
      } else if (rating === "hard") {
        newState = card.state;
        scheduledDays = FSRS_PARAMS.learningSteps[1] / (60 * 24);
      } else {
        newState = "review";
        newStability = calculateInitialStability(rating);
        scheduledDays = calculateNextInterval(newStability, FSRS_PARAMS.requestRetention);
      }
    } else {
      // Review state
      // Check if card qualifies for forgiveness mode (7+ days overdue)
      const overdueMs = now - card.due;
      const overdueDays = overdueMs / (1000 * 60 * 60 * 24);
      const needsForgiveness = overdueDays >= FORGIVENESS_OVERDUE_DAYS;

      if (needsForgiveness && rating !== "again") {
        // Forgiveness mode: Instead of penalizing severely overdue cards,
        // treat them as if they were reviewed on time but with reduced stability
        // This prevents overwhelming users who return after a break
        newDifficulty = card.difficulty;
        newState = "review";

        // Reset stability based on the rating, but don't penalize for the overdue period
        // Use initial stability calculation as a fresh start
        newStability = calculateInitialStability(rating);

        // Apply a small bonus for remembering despite the long gap
        if (rating === "easy") {
          newStability *= 1.5;
        } else if (rating === "good") {
          newStability *= 1.2;
        }

        scheduledDays = calculateNextInterval(newStability, FSRS_PARAMS.requestRetention);
      } else {
        // Normal review path
        const retrievability = calculateRetrievability(elapsedDays, card.stability);
        newDifficulty = calculateNextDifficulty(card.difficulty, rating);

        if (rating === "again") {
          newState = "relearning";
          newStability = calculateNextStability(
            card.difficulty,
            card.stability,
            retrievability,
            rating
          );
          scheduledDays = FSRS_PARAMS.relearningSteps[0] / (60 * 24);
          lapses++;
        } else {
          newState = "review";
          newStability = calculateNextStability(
            card.difficulty,
            card.stability,
            retrievability,
            rating
          );
          scheduledDays = calculateNextInterval(newStability, FSRS_PARAMS.requestRetention);
        }
      }
    }

    // Update the flashcard
    await ctx.db.patch(args.flashcardId, {
      state: newState,
      due: now + scheduledDays * 24 * 60 * 60 * 1000,
      stability: newStability,
      difficulty: newDifficulty,
      elapsedDays,
      scheduledDays,
      reps: card.reps + 1,
      lapses,
      lastReview: now,
      updatedAt: now,
    });

    // Record the review
    await ctx.db.insert("flashcardReviews", {
      userId: card.userId,
      flashcardId: args.flashcardId,
      vocabularyId: card.vocabularyId,
      rating: args.rating,
      previousState: previousState as "new" | "learning" | "review" | "relearning",
      newState,
      responseTime: args.responseTime,
      reviewedAt: now,
    });

    // Update vocabulary stats
    const vocab = await ctx.db.get(card.vocabularyId);
    if (vocab) {
      const isCorrect = rating !== "again";
      await ctx.db.patch(card.vocabularyId, {
        timesReviewed: vocab.timesReviewed + 1,
        timesCorrect: vocab.timesCorrect + (isCorrect ? 1 : 0),
        lastReviewedAt: now,
        updatedAt: now,
      });
    }

    return { newState, scheduledDays };
  },
});

// Swap to a different sentence from the library
export const swapSentence = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    sentenceId: v.id("sentences"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.flashcardId, {
      sentenceId: args.sentenceId,
      updatedAt: Date.now(),
    });
  },
});

// Swap to a different image from the library
export const swapImage = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    imageId: v.optional(v.id("images")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.flashcardId, {
      imageId: args.imageId,
      updatedAt: Date.now(),
    });
  },
});

// Delete a flashcard
export const remove = mutation({
  args: { flashcardId: v.id("flashcards") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.flashcardId);
  },
});

// Complete a review session and update learner profile
export const completeReviewSession = mutation({
  args: {
    userId: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    cardsReviewed: v.number(),
    cardsCorrect: v.number(),
    studyMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.cardsReviewed > 0) {
      // Update learner profile with session stats
      await ctx.scheduler.runAfter(0, internal.learnerModel.updateFromFlashcardsInternal, {
        userId: args.userId,
        language: args.language,
        cardsReviewed: args.cardsReviewed,
        cardsCorrect: args.cardsCorrect,
        studyMinutes: args.studyMinutes,
      });
    }
  },
});

// Undo a flashcard review (restore previous state)
export const unreview = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    previousFlashcardState: v.object({
      state: cardStateValidator,
      due: v.number(),
      stability: v.number(),
      difficulty: v.number(),
      elapsedDays: v.number(),
      scheduledDays: v.number(),
      reps: v.number(),
      lapses: v.number(),
      lastReview: v.optional(v.number()),
    }),
    previousVocabStats: v.object({
      timesReviewed: v.number(),
      timesCorrect: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.flashcardId);
    if (!card) throw new Error("Flashcard not found");

    const now = Date.now();

    // Restore flashcard state
    await ctx.db.patch(args.flashcardId, {
      state: args.previousFlashcardState.state,
      due: args.previousFlashcardState.due,
      stability: args.previousFlashcardState.stability,
      difficulty: args.previousFlashcardState.difficulty,
      elapsedDays: args.previousFlashcardState.elapsedDays,
      scheduledDays: args.previousFlashcardState.scheduledDays,
      reps: args.previousFlashcardState.reps,
      lapses: args.previousFlashcardState.lapses,
      lastReview: args.previousFlashcardState.lastReview,
      updatedAt: now,
    });

    // Restore vocabulary stats
    const vocab = await ctx.db.get(card.vocabularyId);
    if (vocab) {
      await ctx.db.patch(card.vocabularyId, {
        timesReviewed: args.previousVocabStats.timesReviewed,
        timesCorrect: args.previousVocabStats.timesCorrect,
        updatedAt: now,
      });
    }

    // Delete the most recent review record for this flashcard
    const recentReview = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_flashcard", (q) => q.eq("flashcardId", args.flashcardId))
      .order("desc")
      .first();

    if (recentReview) {
      await ctx.db.delete(recentReview._id);
    }

    return { success: true };
  },
});

// ============================================
// INTERNAL MUTATIONS (for actions)
// ============================================

// Swap sentence (internal, for actions)
export const swapSentenceInternal = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    sentenceId: v.id("sentences"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.flashcardId, {
      sentenceId: args.sentenceId,
      updatedAt: Date.now(),
    });
  },
});

// Update sentence (internal, for sentence refresh actions)
// Creates a new sentence in the content library and links it to the flashcard
export const updateSentenceInternal = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    sentence: v.string(),
    sentenceTranslation: v.string(),
    audioUrl: v.optional(v.string()),
    model: v.optional(v.string()), // Model that generated the sentence (passed from generation function)
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
      N5: 1,
      N4: 2,
      N3: 3,
      N2: 4,
      N1: 5,
      A1: 1,
      A2: 2,
      B1: 3,
      B2: 4,
      C1: 5,
      C2: 6,
    };
    const difficulty = vocab.examLevel ? (difficultyMap[vocab.examLevel] ?? 3) : 3;

    const sentenceId = await ctx.db.insert("sentences", {
      word: vocab.word,
      language: vocab.language,
      difficulty,
      sentence: args.sentence,
      translations: {
        en: args.sentenceTranslation,
      },
      audioUrl: args.audioUrl,
      model: args.model ?? "unknown", // Use model from args, or "unknown" for legacy calls
      createdAt: now,
    });

    await ctx.db.patch(args.flashcardId, {
      sentenceId,
      updatedAt: now,
    });
  },
});

// ============================================
// VACATION MODE & SMART SETTINGS
// ============================================

// Toggle vacation mode - pauses SRS scheduling
export const toggleVacationMode = mutation({
  args: {
    userId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get or create user preferences
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!prefs) {
      // Create default preferences with vacation mode
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        display: { showFurigana: true },
        audio: {},
        srs: {
          vacationMode: args.enabled,
          vacationStartedAt: args.enabled ? now : undefined,
        },
        updatedAt: now,
      });
      return { success: true, vacationMode: args.enabled };
    }

    // Update existing preferences
    const newSrs = {
      ...prefs.srs,
      vacationMode: args.enabled,
      vacationStartedAt: args.enabled ? now : undefined,
    };

    // If disabling vacation mode, adjust all card due dates
    if (!args.enabled && prefs.srs.vacationMode && prefs.srs.vacationStartedAt) {
      const vacationDays = Math.floor((now - prefs.srs.vacationStartedAt) / (1000 * 60 * 60 * 24));

      if (vacationDays > 0) {
        // Get all user's cards and push their due dates forward
        const cards = await ctx.db
          .query("flashcards")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();

        const vacationMs = vacationDays * 24 * 60 * 60 * 1000;

        await Promise.all(
          cards.map((card) =>
            ctx.db.patch(card._id, {
              due: card.due + vacationMs,
              updatedAt: now,
            })
          )
        );
      }
    }

    await ctx.db.patch(prefs._id, {
      srs: newSrs,
      updatedAt: now,
    });

    return { success: true, vacationMode: args.enabled };
  },
});

// Update max reviews per session
export const updateMaxReviewsPerSession = mutation({
  args: {
    userId: v.string(),
    maxReviews: v.number(), // 10-100
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const maxReviews = Math.max(10, Math.min(100, args.maxReviews));

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!prefs) {
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        display: { showFurigana: true },
        audio: {},
        srs: { maxReviewsPerSession: maxReviews },
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(prefs._id, {
        srs: { ...prefs.srs, maxReviewsPerSession: maxReviews },
        updatedAt: now,
      });
    }

    return { success: true, maxReviews };
  },
});

// Toggle forgiveness mode
export const toggleForgivenessMode = mutation({
  args: {
    userId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!prefs) {
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        display: { showFurigana: true },
        audio: {},
        srs: { forgivenessMode: args.enabled },
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(prefs._id, {
        srs: { ...prefs.srs, forgivenessMode: args.enabled },
        updatedAt: now,
      });
    }

    return { success: true, forgivenessMode: args.enabled };
  },
});

// Get SRS settings for a user
export const getSrsSettings = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return {
      maxReviewsPerSession: prefs?.srs?.maxReviewsPerSession ?? DEFAULT_MAX_REVIEWS_PER_SESSION,
      forgivenessMode: prefs?.srs?.forgivenessMode ?? true, // Enabled by default
      vacationMode: prefs?.srs?.vacationMode ?? false,
      vacationStartedAt: prefs?.srs?.vacationStartedAt,
      dailyReviewGoal: prefs?.srs?.dailyReviewGoal,
      newCardsPerDay: prefs?.srs?.newCardsPerDay,
    };
  },
});
