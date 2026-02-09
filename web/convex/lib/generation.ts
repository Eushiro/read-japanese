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
import { AUDIO_MODELS, IMAGE_MODELS, TEXT_MODELS } from "../lib/models";
import type { ContentLanguage } from "../schema";
import { languageValidator, proficiencyLevelValidator } from "../schema";

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
    language: languageValidator,
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
    language: languageValidator,
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
    language: languageValidator,
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
 * Store a new sentence in the content library
 */
export const storeSentenceInternal = internalMutation({
  args: {
    word: v.string(),
    language: languageValidator,
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
    language: languageValidator,
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
    language: languageValidator,
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
    language: languageValidator,
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

    // Step 1: Check credit balance (unless skipped for admin/batch ops)
    if (!args.skipUsageCheck) {
      const balanceCheck = await ctx.runQuery(internal.aiHelpers.checkCreditBalance, {
        userId: args.userId,
        action: "sentence",
      });

      if (!balanceCheck.canSpend && !balanceCheck.isAdmin) {
        throw new Error(
          `Insufficient credits. Need ${balanceCheck.cost}, have ${balanceCheck.remaining}. Upgrade your plan for more credits.`
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
      model: TEXT_MODELS.GEMINI_3_FLASH,
    });

    // Step 5: Spend credits (only if not skipped)
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId: args.userId,
        action: "sentence",
        metadata: { word: args.word, vocabularyId: args.vocabularyId },
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
    language: languageValidator,
    skipUsageCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GeneratedImageResult> => {
    // Step 1: Check credit balance (images are expensive)
    if (!args.skipUsageCheck) {
      const balanceCheck = await ctx.runQuery(internal.aiHelpers.checkCreditBalance, {
        userId: args.userId,
        action: "image",
      });

      if (!balanceCheck.canSpend && !balanceCheck.isAdmin) {
        throw new Error(
          `Insufficient credits. Need ${balanceCheck.cost}, have ${balanceCheck.remaining}. Upgrade your plan for more credits.`
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

    // Step 3: Generate new image via AI (using vocab ID for organized storage path)
    const imageResult = await ctx.runAction(internal.ai.generateFlashcardImageAction, {
      word: args.word,
      sentence: args.sentence,
      language: args.language,
      imageId: args.vocabularyId, // Use vocab ID for word-centric storage path
    });

    if (!imageResult.success || !imageResult.imageUrl) {
      throw new Error("Failed to generate image");
    }

    // Step 4: Store in content library
    const imageId = await ctx.runMutation(internal.lib.generation.storeImageInternal, {
      word: args.word,
      language: args.language,
      imageUrl: imageResult.imageUrl,
      model: IMAGE_MODELS.GEMINI_IMAGE,
    });

    // Step 5: Spend credits (only if not skipped)
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId: args.userId,
        action: "image",
        metadata: { word: args.word, vocabularyId: args.vocabularyId },
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
    language: languageValidator,
    isWordAudio: v.optional(v.boolean()), // True if this is word pronunciation, false for sentence
    skipUsageCheck: v.optional(v.boolean()),
    // For word-centric storage organization
    word: v.optional(v.string()), // The vocabulary word (for sentence audio context)
    sentenceId: v.optional(v.string()), // ID for sentence audio path
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

    // Check credit balance
    if (!args.skipUsageCheck) {
      const balanceCheck = await ctx.runQuery(internal.aiHelpers.checkCreditBalance, {
        userId: args.userId,
        action: "audio",
      });

      if (!balanceCheck.canSpend && !balanceCheck.isAdmin) {
        throw new Error(
          `Insufficient credits. Need ${balanceCheck.cost}, have ${balanceCheck.remaining}. Upgrade your plan for more credits.`
        );
      }
    }

    // Determine word context for organized storage
    const word = args.isWordAudio ? args.text : args.word;

    // Generate new audio via TTS with word-centric storage
    const audioResult = await ctx.runAction(internal.ai.generateTTSAudioAction, {
      text: args.text,
      language: args.language,
      word,
      audioType: args.isWordAudio ? "word" : "sentence",
      sentenceId: args.sentenceId,
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
        model: AUDIO_MODELS.GEMINI_TTS,
      });
    }

    // Spend credits
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId: args.userId,
        action: "audio",
        metadata: { text: args.text.substring(0, 50), isWordAudio: args.isWordAudio },
      });
    }

    return {
      audioUrl: audioResult.audioUrl,
      wasReused: false,
    };
  },
});

// ============================================
// PERSONALIZED STORY GENERATION
// ============================================

export interface PersonalizedStoryRequest {
  mustUseWords: string[]; // Words that MUST appear (learning words to reinforce)
  preferWords: string[]; // Known words to prefer (90% should be from here)
  newWordBudget: number; // Max new words allowed (i+1 principle)
  topics: string[]; // User's interests
  language: ContentLanguage;
  difficulty: string; // e.g., "N5", "A1"
  targetWordCount?: number; // Approximate length
}

export interface GeneratedMicroStory {
  title: string;
  content: string; // The story text
  translation: string; // English translation
  vocabulary: Array<{
    word: string;
    reading?: string;
    meaning: string;
    isNew: boolean; // True if this is a new word for the user
  }>;
  wordCount: number;
}

/**
 * Get user's vocabulary organized for story generation
 */
export const getVocabularyForStoryGeneration = internalQuery({
  args: {
    userId: v.string(),
    language: languageValidator,
    learningWordsLimit: v.optional(v.number()),
    knownWordsLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, language, learningWordsLimit = 5, knownWordsLimit = 100 } = args;

    // Get user's vocabulary
    const vocabulary = await ctx.db
      .query("vocabulary")
      .withIndex("by_user_and_language", (q) => q.eq("userId", userId).eq("language", language))
      .collect();

    // Separate by mastery state
    const knownWords: string[] = [];
    const learningWords: string[] = [];

    for (const v of vocabulary) {
      if (v.masteryState === "mastered" || v.masteryState === "tested") {
        knownWords.push(v.word);
      } else if (v.masteryState === "learning") {
        learningWords.push(v.word);
      }
    }

    // Get user's interests
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();

    const interests = user?.interests ?? [];

    return {
      mustUseWords: learningWords.slice(0, learningWordsLimit),
      preferWords: knownWords.slice(0, knownWordsLimit),
      interests,
      totalKnown: knownWords.length,
      totalLearning: learningWords.length,
    };
  },
});

/**
 * Generate a personalized micro-story using user's vocabulary
 */
export const generatePersonalizedMicroStory = internalAction({
  args: {
    userId: v.string(),
    language: languageValidator,
    difficulty: proficiencyLevelValidator,
    newWordBudget: v.optional(v.number()),
    targetWordCount: v.optional(v.number()),
    topic: v.optional(v.string()), // Optional specific topic override
    skipUsageCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GeneratedMicroStory> => {
    const {
      userId,
      language,
      difficulty,
      newWordBudget = 3,
      targetWordCount = 100,
      topic,
      skipUsageCheck = false,
    } = args;

    // Check credit balance
    if (!skipUsageCheck) {
      const balanceCheck = await ctx.runQuery(internal.aiHelpers.checkCreditBalance, {
        userId,
        action: "story",
      });

      if (!balanceCheck.canSpend && !balanceCheck.isAdmin) {
        throw new Error(
          `Insufficient credits. Need ${balanceCheck.cost}, have ${balanceCheck.remaining}. Upgrade your plan for more credits.`
        );
      }
    }

    // Get user's vocabulary
    const vocabData = await ctx.runQuery(internal.lib.generation.getVocabularyForStoryGeneration, {
      userId,
      language,
      learningWordsLimit: 5,
      knownWordsLimit: 100,
    });

    // Determine topic
    const storyTopic =
      topic ||
      (vocabData.interests.length > 0
        ? vocabData.interests[Math.floor(Math.random() * vocabData.interests.length)]
        : "daily life");

    // Generate the story using AI
    const storyResult = await ctx.runAction(internal.ai.generatePersonalizedStoryInternal, {
      mustUseWords: vocabData.mustUseWords,
      preferWords: vocabData.preferWords,
      newWordBudget,
      topic: storyTopic,
      language,
      difficulty,
      targetWordCount,
    });

    // Spend credits
    if (!skipUsageCheck) {
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId,
        action: "story",
        metadata: { topic: storyTopic, difficulty },
      });
    }

    return storyResult;
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
    language: languageValidator,
    skipUsageCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<VerificationResult> => {
    // Check credit balance
    if (!args.skipUsageCheck) {
      const balanceCheck = await ctx.runQuery(internal.aiHelpers.checkCreditBalance, {
        userId: args.userId,
        action: "feedback",
      });

      if (!balanceCheck.canSpend && !balanceCheck.isAdmin) {
        throw new Error(
          `Insufficient credits. Need ${balanceCheck.cost}, have ${balanceCheck.remaining}. Upgrade your plan for more credits.`
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

    // Spend credits
    if (!args.skipUsageCheck) {
      await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
        userId: args.userId,
        action: "feedback",
        metadata: { targetWord: args.targetWord },
      });
    }

    return result;
  },
});
