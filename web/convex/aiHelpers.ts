import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============================================
// INTERNAL QUERIES
// ============================================

// Get vocabulary item for AI sentence generation
export const getVocabulary = internalQuery({
  args: {
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.vocabularyId);
  },
});

// Get existing flashcard for a vocabulary item
export const getFlashcardByVocabulary = internalQuery({
  args: {
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flashcards")
      .withIndex("by_vocabulary", (q) => q.eq("vocabularyId", args.vocabularyId))
      .first();
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

// Create or update flashcard with generated sentence
export const upsertFlashcard = internalMutation({
  args: {
    vocabularyId: v.id("vocabulary"),
    userId: v.string(),
    sentence: v.string(),
    sentenceTranslation: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const now = Date.now();

    // Check if flashcard already exists
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_vocabulary", (q) => q.eq("vocabularyId", args.vocabularyId))
      .first();

    if (existing) {
      // Update existing flashcard with new sentence
      await ctx.db.patch(existing._id, {
        sentence: args.sentence,
        sentenceTranslation: args.sentenceTranslation,
        sentenceGeneratedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new flashcard with FSRS initial values
    const flashcardId = await ctx.db.insert("flashcards", {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      sentence: args.sentence,
      sentenceTranslation: args.sentenceTranslation,

      // FSRS initial values
      state: "new",
      due: now, // Due immediately
      stability: 0,
      difficulty: 0.3, // Default difficulty
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,

      sentenceGeneratedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return flashcardId;
  },
});

// Update flashcard with audio URL
export const updateFlashcardAudio = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.flashcardId, {
      audioUrl: args.audioUrl,
      updatedAt: Date.now(),
    });
  },
});

// Update flashcard with image URL
export const updateFlashcardImage = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.flashcardId, {
      imageUrl: args.imageUrl,
      updatedAt: Date.now(),
    });
  },
});

// Update flashcard with word audio URL
export const updateFlashcardWordAudio = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    wordAudioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.flashcardId, {
      wordAudioUrl: args.wordAudioUrl,
      updatedAt: Date.now(),
    });
  },
});

// Get flashcard by ID
export const getFlashcard = internalQuery({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.flashcardId);
  },
});

// Save user sentence verification result
export const saveUserSentenceVerification = internalMutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    targetWord: v.string(),
    sentence: v.string(),
    isCorrect: v.boolean(),
    grammarScore: v.number(),
    usageScore: v.number(),
    naturalnessScore: v.number(),
    overallScore: v.number(),
    corrections: v.array(
      v.object({
        original: v.string(),
        corrected: v.string(),
        explanation: v.string(),
      })
    ),
    feedback: v.string(),
    improvedSentence: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sentenceId = await ctx.db.insert("userSentences", {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      targetWord: args.targetWord,
      sentence: args.sentence,
      isCorrect: args.isCorrect,
      grammarScore: args.grammarScore,
      usageScore: args.usageScore,
      naturalnessScore: args.naturalnessScore,
      overallScore: args.overallScore,
      corrections: args.corrections,
      feedback: args.feedback,
      improvedSentence: args.improvedSentence,
      createdAt: now,
    });

    return sentenceId;
  },
});
