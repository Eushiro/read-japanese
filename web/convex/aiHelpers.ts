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
// Now stores sentences in the content library
export const upsertFlashcard = internalMutation({
  args: {
    vocabularyId: v.id("vocabulary"),
    userId: v.string(),
    sentence: v.string(),
    sentenceTranslation: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const now = Date.now();

    // Get vocabulary to get word and language
    const vocab = await ctx.db.get(args.vocabularyId);
    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    // Create sentence in content library
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

    // Check if flashcard already exists
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_vocabulary", (q) => q.eq("vocabularyId", args.vocabularyId))
      .first();

    if (existing) {
      // Update existing flashcard with new sentence reference
      await ctx.db.patch(existing._id, {
        sentenceId,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new flashcard with FSRS initial values
    const flashcardId = await ctx.db.insert("flashcards", {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      sentenceId,

      // FSRS initial values
      state: "new",
      due: now, // Due immediately
      stability: 0,
      difficulty: 0.3, // Default difficulty
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,

      createdAt: now,
      updatedAt: now,
    });

    return flashcardId;
  },
});

// Update sentence with audio URL (in content library)
export const updateFlashcardAudio = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const flashcard = await ctx.db.get(args.flashcardId);
    if (!flashcard || !flashcard.sentenceId) {
      throw new Error("Flashcard or sentence not found");
    }

    await ctx.db.patch(flashcard.sentenceId, {
      audioUrl: args.audioUrl,
    });

    await ctx.db.patch(args.flashcardId, {
      updatedAt: Date.now(),
    });
  },
});

// Update flashcard with image (creates/updates in content library)
export const updateFlashcardImage = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    imageUrl: v.string(),
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

    // Check if image already exists for this word
    const existingImage = await ctx.db
      .query("images")
      .withIndex("by_word_language", (q) =>
        q.eq("word", vocab.word).eq("language", vocab.language)
      )
      .first();

    let imageId;
    if (existingImage) {
      // Update existing image
      await ctx.db.patch(existingImage._id, { imageUrl: args.imageUrl });
      imageId = existingImage._id;
    } else {
      // Create new image entry
      imageId = await ctx.db.insert("images", {
        word: vocab.word,
        language: vocab.language,
        imageUrl: args.imageUrl,
        model: "gemini-2.5-flash-image",
        createdAt: now,
      });
    }

    await ctx.db.patch(args.flashcardId, {
      imageId,
      updatedAt: now,
    });
  },
});

// Update flashcard with word audio (creates/updates in content library)
export const updateFlashcardWordAudio = internalMutation({
  args: {
    flashcardId: v.id("flashcards"),
    wordAudioUrl: v.string(),
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

    // Check if word audio already exists
    const existingAudio = await ctx.db
      .query("wordAudio")
      .withIndex("by_word_language", (q) =>
        q.eq("word", vocab.word).eq("language", vocab.language)
      )
      .first();

    if (existingAudio) {
      // Update existing
      await ctx.db.patch(existingAudio._id, {
        audioUrl: args.wordAudioUrl,
      });
    } else {
      // Create new
      await ctx.db.insert("wordAudio", {
        word: vocab.word,
        language: vocab.language,
        audioUrl: args.wordAudioUrl,
        model: "gemini-2.5-flash-preview-tts",
        createdAt: now,
      });
    }

    await ctx.db.patch(args.flashcardId, {
      updatedAt: now,
    });
  },
});

// Clear flashcard pending flag on vocabulary item
export const clearFlashcardPending = internalMutation({
  args: {
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.vocabularyId, {
      flashcardPending: false,
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

// Get flashcard with sentence content resolved
export const getFlashcardWithSentence = internalQuery({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (ctx, args) => {
    const flashcard = await ctx.db.get(args.flashcardId);
    if (!flashcard) return null;

    let sentence = null;
    if (flashcard.sentenceId) {
      sentence = await ctx.db.get(flashcard.sentenceId);
    }

    return {
      ...flashcard,
      sentenceData: sentence,
    };
  },
});

// Get placement test by ID
export const getPlacementTest = internalQuery({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testId);
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

// ============================================
// PREMADE VOCABULARY HELPERS
// ============================================

// Get premade vocabulary item for AI enhancement
export const getPremadeVocabulary = internalQuery({
  args: {
    premadeVocabularyId: v.id("premadeVocabulary"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.premadeVocabularyId);
  },
});

// Get word audio by word and language
export const getWordAudioByWord = internalQuery({
  args: {
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wordAudio")
      .withIndex("by_word_language", (q) =>
        q.eq("word", args.word).eq("language", args.language)
      )
      .first();
  },
});

// Get sentence by ID
export const getSentenceById = internalQuery({
  args: {
    sentenceId: v.id("sentences"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sentenceId);
  },
});

// Update premade vocabulary with generated content
// Now stores content in the content library tables
export const updatePremadeVocabularyContent = internalMutation({
  args: {
    premadeVocabularyId: v.id("premadeVocabulary"),
    sentence: v.optional(v.string()),
    sentenceTranslation: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    wordAudioUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const premade = await ctx.db.get(args.premadeVocabularyId);
    if (!premade) {
      throw new Error("Premade vocabulary not found");
    }

    const updates: Record<string, any> = { updatedAt: now };

    // Create sentence in content library
    if (args.sentence) {
      const difficultyMap: Record<string, number> = {
        N5: 1, N4: 2, N3: 3, N2: 4, N1: 5,
        A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
      };
      const difficulty = difficultyMap[premade.level] ?? 3;

      const sentenceId = await ctx.db.insert("sentences", {
        word: premade.word,
        language: premade.language,
        difficulty,
        sentence: args.sentence,
        translations: {
          en: args.sentenceTranslation,
        },
        audioUrl: args.audioUrl,
        model: "gemini-3-flash",
        createdAt: now,
      });
      updates.sentenceId = sentenceId;
    }

    // Create word audio in content library
    if (args.wordAudioUrl) {
      const existingAudio = await ctx.db
        .query("wordAudio")
        .withIndex("by_word_language", (q) =>
          q.eq("word", premade.word).eq("language", premade.language)
        )
        .first();

      if (!existingAudio) {
        await ctx.db.insert("wordAudio", {
          word: premade.word,
          language: premade.language,
          audioUrl: args.wordAudioUrl,
          model: "gemini-2.5-flash-preview-tts",
          createdAt: now,
        });
      }
    }

    // Create image in content library
    if (args.imageUrl) {
      const existingImage = await ctx.db
        .query("images")
        .withIndex("by_word_language", (q) =>
          q.eq("word", premade.word).eq("language", premade.language)
        )
        .first();

      if (!existingImage) {
        const imageId = await ctx.db.insert("images", {
          word: premade.word,
          language: premade.language,
          imageUrl: args.imageUrl,
          model: "gemini-2.5-flash-image",
          createdAt: now,
        });
        updates.imageId = imageId;
      } else {
        updates.imageId = existingImage._id;
      }
    }

    await ctx.db.patch(args.premadeVocabularyId, updates);
  },
});
