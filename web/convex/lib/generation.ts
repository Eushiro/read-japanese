/**
 * Centralized Generation Layer
 *
 * All AI content generation MUST go through these functions to ensure:
 * 1. Usage limits are checked (paywall enforcement)
 * 2. Content library is checked first (content reuse)
 * 3. User hasn't seen the content (variety tracking)
 * 4. Usage is tracked after generation
 *
 * DO NOT call AI APIs directly from features. Use these functions instead.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { TIER_LIMITS } from "../subscriptions";

// ============================================
// TYPES
// ============================================

// UI language translations object
export interface SentenceTranslations {
  en?: string;
  ja?: string;
  fr?: string;
  zh?: string;
}

export interface GeneratedSentenceResult {
  sentenceId: Id<"sentences">;
  sentence: string;
  translation: string; // Backwards compatibility (English)
  translations: SentenceTranslations; // All UI language translations
  audioUrl?: string;
  wasReused: boolean; // True if from content library, false if newly generated
}

export interface GeneratedImageResult {
  imageId: Id<"images">;
  imageUrl: string;
  wasReused: boolean;
}

export interface GeneratedAudioResult {
  audioUrl: string;
  wasReused: boolean;
}

export interface UsageLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
}

// ============================================
// USAGE LIMIT CHECKING (internal queries)
// ============================================

/**
 * Check if user can perform a generation action
 */
export const checkUsageLimit = internalQuery({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("aiVerification"),
      v.literal("readStory"),
      v.literal("generatePersonalizedStory"),
      v.literal("generateMockTest"),
      v.literal("generateFlashcard"),
      v.literal("generateAudio")
    ),
  },
  handler: async (ctx, args): Promise<UsageLimitResult> => {
    // Get subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const tier = subscription?.tier ?? "free";
    const limits = TIER_LIMITS[tier];

    // Get current usage
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const actionToLimit: Record<string, { limitKey: keyof typeof limits; usageKey: string }> = {
      aiVerification: { limitKey: "aiVerificationsPerMonth", usageKey: "aiVerifications" },
      readStory: { limitKey: "storiesPerMonth", usageKey: "storiesRead" },
      generatePersonalizedStory: {
        limitKey: "personalizedStoriesPerMonth",
        usageKey: "personalizedStoriesGenerated",
      },
      generateMockTest: { limitKey: "mockTestsPerMonth", usageKey: "mockTestsGenerated" },
      generateFlashcard: { limitKey: "flashcardsPerMonth", usageKey: "flashcardsGenerated" },
      generateAudio: { limitKey: "audioPerMonth", usageKey: "audioGenerated" },
    };

    const { limitKey, usageKey } = actionToLimit[args.action];
    const limit = limits[limitKey];
    const currentUsage = usage ? ((usage as unknown as Record<string, number>)[usageKey] ?? 0) : 0;

    const remaining = limit - currentUsage;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      limit,
      used: currentUsage,
    };
  },
});

// ============================================
// CONTENT LIBRARY LOOKUP (internal queries)
// ============================================

/**
 * Find an unseen sentence for a user's vocabulary word
 */
export const findUnseenSentenceForUser = internalQuery({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    difficulty: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"sentences"> | null> => {
    // Get all available sentences for this word
    const sentences = await ctx.db
      .query("sentences")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .collect();

    if (sentences.length === 0) {
      return null;
    }

    // Filter by difficulty if specified
    let filteredSentences = sentences;
    if (args.difficulty !== undefined) {
      const matchingDifficulty = sentences.filter((s) => s.difficulty === args.difficulty);
      if (matchingDifficulty.length > 0) {
        filteredSentences = matchingDifficulty;
      }
    }

    // Get user's content history for this vocabulary item
    const history = await ctx.db
      .query("userContentHistory")
      .withIndex("by_user_vocabulary", (q) =>
        q.eq("userId", args.userId).eq("vocabularyId", args.vocabularyId)
      )
      .first();

    const seenIds = history?.seenSentenceIds ?? [];
    const seenIdSet = new Set(seenIds.map((id) => id.toString()));

    // Find sentences the user hasn't seen
    const unseenSentences = filteredSentences.filter((s) => !seenIdSet.has(s._id.toString()));

    if (unseenSentences.length > 0) {
      // Return a random unseen sentence for variety
      return unseenSentences[Math.floor(Math.random() * unseenSentences.length)];
    }

    // All sentences seen - return a random one (better to repeat than regenerate)
    return filteredSentences[Math.floor(Math.random() * filteredSentences.length)];
  },
});

/**
 * Find an unseen image for a user's vocabulary word
 */
export const findUnseenImageForUser = internalQuery({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
  },
  handler: async (ctx, args): Promise<Doc<"images"> | null> => {
    const images = await ctx.db
      .query("images")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .collect();

    if (images.length === 0) {
      return null;
    }

    const history = await ctx.db
      .query("userContentHistory")
      .withIndex("by_user_vocabulary", (q) =>
        q.eq("userId", args.userId).eq("vocabularyId", args.vocabularyId)
      )
      .first();

    const seenIds = history?.seenImageIds ?? [];
    const seenIdSet = new Set(seenIds.map((id) => id.toString()));

    const unseenImages = images.filter((img) => !seenIdSet.has(img._id.toString()));

    if (unseenImages.length > 0) {
      return unseenImages[Math.floor(Math.random() * unseenImages.length)];
    }

    // All images seen - return a random one
    return images[Math.floor(Math.random() * images.length)];
  },
});

/**
 * Find existing word audio
 */
export const findWordAudio = internalQuery({
  args: {
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
  },
  handler: async (ctx, args): Promise<Doc<"wordAudio"> | null> => {
    return await ctx.db
      .query("wordAudio")
      .withIndex("by_word_language", (q) => q.eq("word", args.word).eq("language", args.language))
      .first();
  },
});

// ============================================
// CONTENT TRACKING (internal mutations)
// ============================================

/**
 * Mark a sentence as seen by a user
 */
export const markSentenceSeen = internalMutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    sentenceId: v.id("sentences"),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userContentHistory")
      .withIndex("by_user_vocabulary", (q) =>
        q.eq("userId", args.userId).eq("vocabularyId", args.vocabularyId)
      )
      .first();

    if (existing) {
      // Don't add duplicates
      if (!existing.seenSentenceIds.includes(args.sentenceId)) {
        await ctx.db.patch(existing._id, {
          seenSentenceIds: [...existing.seenSentenceIds, args.sentenceId],
          lastShownAt: now,
        });
      }
    } else {
      await ctx.db.insert("userContentHistory", {
        userId: args.userId,
        vocabularyId: args.vocabularyId,
        seenSentenceIds: [args.sentenceId],
        seenImageIds: [],
        lastShownAt: now,
        createdAt: now,
      });
    }
  },
});

/**
 * Mark an image as seen by a user
 */
export const markImageSeen = internalMutation({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    imageId: v.id("images"),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userContentHistory")
      .withIndex("by_user_vocabulary", (q) =>
        q.eq("userId", args.userId).eq("vocabularyId", args.vocabularyId)
      )
      .first();

    if (existing) {
      if (!existing.seenImageIds.includes(args.imageId)) {
        await ctx.db.patch(existing._id, {
          seenImageIds: [...existing.seenImageIds, args.imageId],
          lastShownAt: now,
        });
      }
    } else {
      await ctx.db.insert("userContentHistory", {
        userId: args.userId,
        vocabularyId: args.vocabularyId,
        seenSentenceIds: [],
        seenImageIds: [args.imageId],
        lastShownAt: now,
        createdAt: now,
      });
    }
  },
});

/**
 * Increment usage counter (wraps the mutation from subscriptions.ts)
 */
export const incrementUsageInternal = internalMutation({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("aiVerification"),
      v.literal("readStory"),
      v.literal("generatePersonalizedStory"),
      v.literal("generateMockTest"),
      v.literal("generateFlashcard"),
      v.literal("generateAudio")
    ),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const increment = args.count ?? 1;

    const existing = await ctx.db
      .query("usageRecords")
      .withIndex("by_user_and_period", (q) =>
        q.eq("userId", args.userId).eq("periodYear", year).eq("periodMonth", month)
      )
      .first();

    const actionToField: Record<string, string> = {
      aiVerification: "aiVerifications",
      readStory: "storiesRead",
      generatePersonalizedStory: "personalizedStoriesGenerated",
      generateMockTest: "mockTestsGenerated",
      generateFlashcard: "flashcardsGenerated",
      generateAudio: "audioGenerated",
    };

    const field = actionToField[args.action];

    if (existing) {
      await ctx.db.patch(existing._id, {
        [field]: ((existing as unknown as Record<string, number>)[field] ?? 0) + increment,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("usageRecords", {
        userId: args.userId,
        periodMonth: month,
        periodYear: year,
        aiVerifications: args.action === "aiVerification" ? increment : 0,
        storiesRead: args.action === "readStory" ? increment : 0,
        personalizedStoriesGenerated: args.action === "generatePersonalizedStory" ? increment : 0,
        mockTestsGenerated: args.action === "generateMockTest" ? increment : 0,
        flashcardsGenerated: args.action === "generateFlashcard" ? increment : 0,
        audioGenerated: args.action === "generateAudio" ? increment : 0,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Store a new sentence in the content library
 */
export const storeSentenceInternal = internalMutation({
  args: {
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    difficulty: v.number(),
    sentence: v.string(),
    translation: v.optional(v.string()), // Backwards compatibility
    translations: v.optional(
      v.object({
        en: v.optional(v.string()),
        ja: v.optional(v.string()),
        fr: v.optional(v.string()),
        zh: v.optional(v.string()),
      })
    ),
    audioUrl: v.optional(v.string()),
    model: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"sentences">> => {
    // Use translations object if provided, fallback to single translation for backwards compatibility
    const translations = args.translations ?? {
      en: args.translation,
    };

    return await ctx.db.insert("sentences", {
      word: args.word,
      language: args.language,
      difficulty: args.difficulty,
      sentence: args.sentence,
      translations,
      audioUrl: args.audioUrl,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

/**
 * Store a new image in the content library
 */
export const storeImageInternal = internalMutation({
  args: {
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    imageUrl: v.string(),
    style: v.optional(v.string()),
    model: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"images">> => {
    return await ctx.db.insert("images", {
      word: args.word,
      language: args.language,
      imageUrl: args.imageUrl,
      style: args.style,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

/**
 * Store word audio in the content library
 */
export const storeWordAudioInternal = internalMutation({
  args: {
    word: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    audioUrl: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"wordAudio">> => {
    return await ctx.db.insert("wordAudio", {
      word: args.word,
      language: args.language,
      audioUrl: args.audioUrl,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

// ============================================
// GATED GENERATION ACTIONS
// ============================================

/**
 * Generate (or reuse) a sentence for a vocabulary word
 *
 * This is the main entry point for sentence generation. It:
 * 1. Checks usage limits
 * 2. Looks for existing unseen content in the library
 * 3. Generates new content if needed
 * 4. Stores in content library
 * 5. Increments usage
 * 6. Tracks what user has seen
 */
export const generateSentenceForWord = internalAction({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    examLevel: v.optional(v.string()),
    skipUsageCheck: v.optional(v.boolean()), // For batch/admin operations
  },
  handler: async (ctx, args): Promise<GeneratedSentenceResult> => {
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
    const difficulty = args.examLevel ? (difficultyMap[args.examLevel] ?? 3) : 3;

    // Step 1: Check usage limits (unless skipped for admin/batch ops)
    if (!args.skipUsageCheck) {
      const usageCheck = await ctx.runQuery(internal.lib.generation.checkUsageLimit, {
        userId: args.userId,
        action: "generateFlashcard",
      });

      if (!usageCheck.allowed) {
        throw new Error(
          `Usage limit reached. You've used ${usageCheck.used}/${usageCheck.limit} flashcard generations this month. ` +
            `Upgrade your plan for more.`
        );
      }
    }

    // Step 2: Check content library for existing unseen sentence
    const existingSentence = await ctx.runQuery(internal.lib.generation.findUnseenSentenceForUser, {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      word: args.word,
      language: args.language,
      difficulty,
    });

    if (existingSentence) {
      // Mark as seen and return existing
      await ctx.runMutation(internal.lib.generation.markSentenceSeen, {
        userId: args.userId,
        vocabularyId: args.vocabularyId,
        sentenceId: existingSentence._id,
      });

      return {
        sentenceId: existingSentence._id,
        sentence: existingSentence.sentence,
        translation: existingSentence.translations.en ?? "", // Backwards compatibility
        translations: existingSentence.translations,
        audioUrl: existingSentence.audioUrl,
        wasReused: true,
      };
    }

    // Step 3: Generate new sentence via AI
    const generated = await ctx.runAction(internal.ai.generateSentenceInternal, {
      word: args.word,
      reading: args.reading,
      definitions: args.definitions,
      language: args.language,
      examLevel: args.examLevel,
    });

    // Step 4: Store in content library with all translations
    const sentenceId = await ctx.runMutation(internal.lib.generation.storeSentenceInternal, {
      word: args.word,
      language: args.language,
      difficulty,
      sentence: generated.sentence,
      translations: generated.translations,
      model: "gemini-3-flash",
    });

    // Step 5: Increment usage (only if not skipped)
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.lib.generation.incrementUsageInternal, {
        userId: args.userId,
        action: "generateFlashcard",
      });
    }

    // Step 6: Mark as seen
    await ctx.runMutation(internal.lib.generation.markSentenceSeen, {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      sentenceId,
    });

    return {
      sentenceId,
      sentence: generated.sentence,
      translation: generated.translation, // Backwards compatibility
      translations: generated.translations,
      wasReused: false,
    };
  },
});

/**
 * Generate (or reuse) an image for a vocabulary word
 */
export const generateImageForWord = internalAction({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    word: v.string(),
    sentence: v.string(), // Context sentence for better image
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    skipUsageCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GeneratedImageResult> => {
    // Step 1: Check usage limits (images are expensive, count towards flashcard limit)
    if (!args.skipUsageCheck) {
      const usageCheck = await ctx.runQuery(internal.lib.generation.checkUsageLimit, {
        userId: args.userId,
        action: "generateFlashcard",
      });

      if (!usageCheck.allowed) {
        throw new Error(
          `Usage limit reached. You've used ${usageCheck.used}/${usageCheck.limit} generations this month. ` +
            `Upgrade your plan for more.`
        );
      }
    }

    // Step 2: Check content library for existing unseen image
    const existingImage = await ctx.runQuery(internal.lib.generation.findUnseenImageForUser, {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      word: args.word,
      language: args.language,
    });

    if (existingImage) {
      // Mark as seen and return existing
      await ctx.runMutation(internal.lib.generation.markImageSeen, {
        userId: args.userId,
        vocabularyId: args.vocabularyId,
        imageId: existingImage._id,
      });

      return {
        imageId: existingImage._id,
        imageUrl: existingImage.imageUrl,
        wasReused: true,
      };
    }

    // Step 3: Generate new image via AI
    const imageResult = await ctx.runAction(internal.ai.generateFlashcardImageAction, {
      word: args.word,
      sentence: args.sentence,
      language: args.language,
    });

    if (!imageResult.success || !imageResult.imageUrl) {
      throw new Error("Failed to generate image");
    }

    // Step 4: Store in content library
    const imageId = await ctx.runMutation(internal.lib.generation.storeImageInternal, {
      word: args.word,
      language: args.language,
      imageUrl: imageResult.imageUrl,
      model: "gemini-2.5-flash-image",
    });

    // Step 5: Increment usage (only if not skipped)
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.lib.generation.incrementUsageInternal, {
        userId: args.userId,
        action: "generateFlashcard",
      });
    }

    // Step 6: Mark as seen
    await ctx.runMutation(internal.lib.generation.markImageSeen, {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      imageId,
    });

    return {
      imageId,
      imageUrl: imageResult.imageUrl,
      wasReused: false,
    };
  },
});

/**
 * Generate audio for a sentence (or word)
 */
export const generateAudioForText = internalAction({
  args: {
    userId: v.string(),
    text: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    isWordAudio: v.optional(v.boolean()), // True if this is word pronunciation, false for sentence
    skipUsageCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GeneratedAudioResult> => {
    // For word audio, check if it already exists in content library
    if (args.isWordAudio) {
      const existingAudio = await ctx.runQuery(internal.lib.generation.findWordAudio, {
        word: args.text,
        language: args.language,
      });

      if (existingAudio) {
        return {
          audioUrl: existingAudio.audioUrl,
          wasReused: true,
        };
      }
    }

    // Check usage limits
    if (!args.skipUsageCheck) {
      const usageCheck = await ctx.runQuery(internal.lib.generation.checkUsageLimit, {
        userId: args.userId,
        action: "generateAudio",
      });

      if (!usageCheck.allowed) {
        throw new Error(
          `Audio limit reached. You've used ${usageCheck.used}/${usageCheck.limit} audio generations this month. ` +
            `Upgrade your plan for more.`
        );
      }
    }

    // Generate new audio via TTS
    const audioResult = await ctx.runAction(internal.ai.generateTTSAudioAction, {
      text: args.text,
      language: args.language,
    });

    if (!audioResult.success || !audioResult.audioUrl) {
      throw new Error("Failed to generate audio");
    }

    // Store word audio in content library (for reuse)
    if (args.isWordAudio) {
      await ctx.runMutation(internal.lib.generation.storeWordAudioInternal, {
        word: args.text,
        language: args.language,
        audioUrl: audioResult.audioUrl,
        model: "gemini-2.5-flash-preview-tts",
      });
    }

    // Increment usage
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.lib.generation.incrementUsageInternal, {
        userId: args.userId,
        action: "generateAudio",
      });
    }

    return {
      audioUrl: audioResult.audioUrl,
      wasReused: false,
    };
  },
});

/**
 * Verify a user's sentence (AI grading)
 * This increments aiVerification usage
 */
interface VerificationResult {
  isCorrect: boolean;
  grammarScore: number;
  usageScore: number;
  naturalnessScore: number;
  overallScore: number;
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  feedback: string;
  improvedSentence: string;
}

export const verifySentenceWithGating = internalAction({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    targetWord: v.string(),
    userSentence: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    skipUsageCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<VerificationResult> => {
    // Check usage limits
    if (!args.skipUsageCheck) {
      const usageCheck = await ctx.runQuery(internal.lib.generation.checkUsageLimit, {
        userId: args.userId,
        action: "aiVerification",
      });

      if (!usageCheck.allowed) {
        throw new Error(
          `AI verification limit reached. You've used ${usageCheck.used}/${usageCheck.limit} checks this month. ` +
            `Upgrade your plan for more.`
        );
      }
    }

    // Call the verification action
    const result = await ctx.runAction(internal.ai.verifySentenceInternal, {
      userId: args.userId,
      vocabularyId: args.vocabularyId,
      targetWord: args.targetWord,
      sentence: args.userSentence,
      language: args.language,
    });

    // Increment usage
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.lib.generation.incrementUsageInternal, {
        userId: args.userId,
        action: "aiVerification",
      });
    }

    return result;
  },
});
