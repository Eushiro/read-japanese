import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { languageValidator } from "./schema";

// ============================================
// SENTENCES
// ============================================

// Get all sentences for a word (for swapping)
export const getSentencesForWord = query({
  args: {
    word: v.string(),
    language: languageValidator,
    difficulty: v.optional(v.number()), // Filter by difficulty if provided
  },
  handler: async (ctx, args) => {
    const sentences = await ctx.db
      .query("sentences")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .collect();

    if (args.difficulty !== undefined) {
      // Return sentences at or below the requested difficulty
      return sentences.filter((s) => s.difficulty <= args.difficulty!);
    }

    return sentences;
  },
});

// Get a specific sentence by ID
export const getSentence = query({
  args: {
    sentenceId: v.id("sentences"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sentenceId);
  },
});

// Add a sentence to the library
export const addSentence = mutation({
  args: {
    word: v.string(),
    language: languageValidator,
    difficulty: v.number(),
    sentence: v.string(),
    translations: v.object({
      en: v.optional(v.string()),
      ja: v.optional(v.string()),
      fr: v.optional(v.string()),
      es: v.optional(v.string()),
      zh: v.optional(v.string()),
    }),
    audioUrl: v.optional(v.string()),
    model: v.string(),
    createdBy: v.optional(v.string()), // userId for user submissions
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sentences", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update sentence audio URL
export const updateSentenceAudio = mutation({
  args: {
    sentenceId: v.id("sentences"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sentenceId, {
      audioUrl: args.audioUrl,
    });
  },
});

// Add translation to existing sentence
export const addSentenceTranslation = mutation({
  args: {
    sentenceId: v.id("sentences"),
    // eslint-disable-next-line no-restricted-syntax -- dynamic key ("en", "ja", "fr", "es", "zh"), not a content language
    languageCode: v.string(),
    translation: v.string(),
  },
  handler: async (ctx, args) => {
    const sentence = await ctx.db.get(args.sentenceId);
    if (!sentence) throw new Error("Sentence not found");

    const translations = { ...sentence.translations };
    (translations as Record<string, string>)[args.languageCode] = args.translation;

    await ctx.db.patch(args.sentenceId, { translations });
  },
});

// ============================================
// IMAGES
// ============================================

// Get all images for a word (for swapping)
export const getImagesForWord = query({
  args: {
    word: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("images")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .collect();
  },
});

// Get a specific image by ID
export const getImage = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
  },
});

// Add an image to the library
export const addImage = mutation({
  args: {
    word: v.string(),
    language: languageValidator,
    imageUrl: v.string(),
    style: v.optional(v.string()),
    model: v.string(),
    createdBy: v.optional(v.string()), // userId for user submissions
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("images", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// WORD AUDIO
// ============================================

// Get word audio (typically just one per word+language)
export const getWordAudio = query({
  args: {
    word: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wordAudio")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .first();
  },
});

// Add word audio to the library
export const addWordAudio = mutation({
  args: {
    word: v.string(),
    language: languageValidator,
    audioUrl: v.string(),
    model: v.string(),
    createdBy: v.optional(v.string()), // userId for user submissions
  },
  handler: async (ctx, args) => {
    // Check if audio already exists for this word
    const existing = await ctx.db
      .query("wordAudio")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        audioUrl: args.audioUrl,
        model: args.model,
        createdBy: args.createdBy,
      });
      return existing._id;
    }

    return await ctx.db.insert("wordAudio", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// BULK OPERATIONS
// ============================================

// Get or create word audio (returns existing or creates new)
export const getOrCreateWordAudio = mutation({
  args: {
    word: v.string(),
    language: languageValidator,
    audioUrl: v.string(),
    model: v.string(),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wordAudio")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .first();

    if (existing) {
      return existing;
    }

    const id = await ctx.db.insert("wordAudio", {
      word: args.word,
      language: args.language,
      audioUrl: args.audioUrl,
      model: args.model,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

// Batch fetch content for multiple words (for flashcard display)
export const getContentForWords = query({
  args: {
    words: v.array(
      v.object({
        word: v.string(),
        language: languageValidator,
        sentenceId: v.optional(v.id("sentences")),
        imageId: v.optional(v.id("images")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.words.map(async (item) => {
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
          word: item.word,
          sentence,
          image,
          wordAudio,
        };
      })
    );

    return results;
  },
});

// ============================================
// STATS
// ============================================

// Get library stats for a language
export const getLibraryStats = query({
  args: {
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const [sentences, images, wordAudios] = await Promise.all([
      ctx.db
        .query("sentences")
        .withIndex("by_word_language")
        .filter((q) => q.eq(q.field("language"), args.language))
        .collect(),
      ctx.db
        .query("images")
        .withIndex("by_word_language")
        .filter((q) => q.eq(q.field("language"), args.language))
        .collect(),
      ctx.db
        .query("wordAudio")
        .withIndex("by_word_language")
        .filter((q) => q.eq(q.field("language"), args.language))
        .collect(),
    ]);

    // Count unique words
    const uniqueSentenceWords = new Set(sentences.map((s) => s.word));
    const uniqueImageWords = new Set(images.map((i) => i.word));
    const uniqueAudioWords = new Set(wordAudios.map((a) => a.word));

    // Sentences by difficulty
    const sentencesByDifficulty: Record<number, number> = {};
    for (const s of sentences) {
      sentencesByDifficulty[s.difficulty] = (sentencesByDifficulty[s.difficulty] || 0) + 1;
    }

    return {
      sentences: {
        total: sentences.length,
        uniqueWords: uniqueSentenceWords.size,
        byDifficulty: sentencesByDifficulty,
        withAudio: sentences.filter((s) => s.audioUrl).length,
      },
      images: {
        total: images.length,
        uniqueWords: uniqueImageWords.size,
      },
      wordAudio: {
        total: wordAudios.length,
        uniqueWords: uniqueAudioWords.size,
      },
    };
  },
});
