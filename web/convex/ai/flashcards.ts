"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { uploadSentenceAudio, uploadWordAudio, uploadWordImage } from "../lib/storage";
import {
  callWithRetry,
  type CallWithRetryResult,
  callWithRetryTracked,
  type GeneratedSentence,
  type JsonSchema,
  languageNames,
  parseJson,
  type SentenceTranslations,
  uiLanguageNames,
} from "./core";
import { generateFlashcardImage, generateTTSAudio } from "./media";

// ============================================
// SENTENCE GENERATION
// ============================================

interface RawGeneratedSentence {
  sentence: string;
  translations: SentenceTranslations;
}

// Helper function to generate sentence (not a Convex action)
import type { ContentLanguage } from "../schema";

export async function generateSentenceHelper(args: {
  word: string;
  reading?: string;
  definitions: string[];
  language: ContentLanguage;
  examLevel?: string;
}): Promise<GeneratedSentence> {
  const languageName = languageNames[args.language];
  const definitionList = args.definitions.join(", ");
  const readingInfo = args.reading ? ` (reading: ${args.reading})` : "";
  const levelInfo = args.examLevel ? ` at ${args.examLevel} level` : "";

  const systemPrompt = `You are a language learning assistant that creates natural, contextual example sentences for vocabulary study. Your sentences should:
1. Be natural and commonly used in everyday situations
2. Clearly demonstrate the meaning of the target word
3. Be appropriate for the learner's level
4. Be memorable and interesting

Respond ONLY with valid JSON in this exact format:
{
  "sentence": "the example sentence in ${languageName}",
  "translations": {
    "en": "English translation",
    "ja": "Japanese translation (日本語訳)",
    "fr": "French translation (traduction française)",
    "zh": "Chinese translation (中文翻译)"
  }
}`;

  const prompt = `Create an example sentence for the ${languageName} word "${args.word}"${readingInfo}${levelInfo}.

The word means: ${definitionList}

Generate a natural, memorable sentence that clearly shows how to use this word. The sentence should be appropriate for language learners${levelInfo}.

Provide translations in all 4 languages: English, Japanese, French, and Chinese (Simplified).`;

  const sentenceSchema: JsonSchema = {
    name: "example_sentence",
    schema: {
      type: "object",
      properties: {
        sentence: { type: "string", description: "The example sentence in the target language" },
        translations: {
          type: "object",
          description: "Translations in all UI languages",
          properties: {
            en: { type: "string", description: "English translation" },
            ja: { type: "string", description: "Japanese translation" },
            fr: { type: "string", description: "French translation" },
            zh: { type: "string", description: "Chinese (Simplified) translation" },
          },
          required: ["en", "ja", "fr", "zh"],
          additionalProperties: false,
        },
      },
      required: ["sentence", "translations"],
      additionalProperties: false,
    },
  };

  return callWithRetry<GeneratedSentence>({
    prompt,
    systemPrompt,
    maxTokens: 800, // Increased for multiple translations
    jsonSchema: sentenceSchema,
    parse: (response) => {
      const parsed = parseJson<RawGeneratedSentence>(response);
      return {
        sentence: parsed.sentence,
        translation: parsed.translations.en ?? "", // Backwards compatibility
        translations: parsed.translations,
      };
    },
    validate: (parsed) => {
      if (!parsed.sentence || !parsed.translations) {
        return "Missing sentence or translations";
      }
      if (!parsed.translations.en) {
        return "Missing English translation";
      }
      return null;
    },
  });
}

// Tracked version that returns usage data for cost monitoring
export async function generateSentenceHelperTracked(args: {
  word: string;
  reading?: string;
  definitions: string[];
  language: ContentLanguage;
  examLevel?: string;
}): Promise<CallWithRetryResult<GeneratedSentence>> {
  const languageName = languageNames[args.language];
  const definitionList = args.definitions.join(", ");
  const readingInfo = args.reading ? ` (reading: ${args.reading})` : "";
  const levelInfo = args.examLevel ? ` at ${args.examLevel} level` : "";

  const systemPrompt = `You are a language learning assistant that creates natural, contextual example sentences for vocabulary study. Your sentences should:
1. Be natural and commonly used in everyday situations
2. Clearly demonstrate the meaning of the target word
3. Be appropriate for the learner's level
4. Be memorable and interesting

Respond ONLY with valid JSON in this exact format:
{
  "sentence": "the example sentence in ${languageName}",
  "translations": {
    "en": "English translation",
    "ja": "Japanese translation (日本語訳)",
    "fr": "French translation (traduction française)",
    "zh": "Chinese translation (中文翻译)"
  }
}`;

  const prompt = `Create an example sentence for the ${languageName} word "${args.word}"${readingInfo}${levelInfo}.

The word means: ${definitionList}

Generate a natural, memorable sentence that clearly shows how to use this word. The sentence should be appropriate for language learners${levelInfo}.

Provide translations in all 4 languages: English, Japanese, French, and Chinese (Simplified).`;

  const sentenceSchema: JsonSchema = {
    name: "example_sentence",
    schema: {
      type: "object",
      properties: {
        sentence: { type: "string", description: "The example sentence in the target language" },
        translations: {
          type: "object",
          description: "Translations in all UI languages",
          properties: {
            en: { type: "string", description: "English translation" },
            ja: { type: "string", description: "Japanese translation" },
            fr: { type: "string", description: "French translation" },
            zh: { type: "string", description: "Chinese (Simplified) translation" },
          },
          required: ["en", "ja", "fr", "zh"],
          additionalProperties: false,
        },
      },
      required: ["sentence", "translations"],
      additionalProperties: false,
    },
  };

  return callWithRetryTracked<GeneratedSentence>({
    prompt,
    systemPrompt,
    maxTokens: 800,
    jsonSchema: sentenceSchema,
    parse: (response) => {
      const parsed = parseJson<RawGeneratedSentence>(response);
      return {
        sentence: parsed.sentence,
        translation: parsed.translations.en ?? "",
        translations: parsed.translations,
      };
    },
    validate: (parsed) => {
      if (!parsed.sentence || !parsed.translations) {
        return "Missing sentence or translations";
      }
      if (!parsed.translations.en) {
        return "Missing English translation";
      }
      return null;
    },
  });
}

// Generate an example sentence for a vocabulary word (public action)
export const generateSentence = action({
  args: {
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    examLevel: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<GeneratedSentence> => {
    return generateSentenceHelper({
      word: args.word,
      reading: args.reading ?? undefined,
      definitions: args.definitions,
      language: args.language,
      examLevel: args.examLevel ?? undefined,
    });
  },
});

// Internal action for scheduled jobs to call
export const generateSentenceInternal = internalAction({
  args: {
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    examLevel: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<GeneratedSentence> => {
    return generateSentenceHelper({
      word: args.word,
      reading: args.reading ?? undefined,
      definitions: args.definitions,
      language: args.language,
      examLevel: args.examLevel ?? undefined,
    });
  },
});

// Generate a sentence and create/update a flashcard
export const generateFlashcard = action({
  args: {
    vocabularyId: v.id("vocabulary"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; flashcardId?: string }> => {
    // Get the vocabulary item
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: args.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary item not found");
    }

    // Require authentication - verify user owns this vocabulary
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    if (vocab.userId !== identity.subject) {
      throw new Error("Unauthorized: You don't own this vocabulary item");
    }

    // Spend credits before generation
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: vocab.userId,
      action: "sentence",
      metadata: { word: vocab.word, vocabularyId: args.vocabularyId },
    });

    // Generate the sentence using the tracked helper
    const { result: generated, usage } = await generateSentenceHelperTracked({
      word: vocab.word,
      reading: vocab.reading ?? undefined,
      definitions: vocab.definitions,
      language: vocab.language,
      examLevel: vocab.examLevel ?? undefined,
    });

    // Log AI usage for cost tracking
    await ctx.runMutation(internal.aiUsage.log, {
      userId: vocab.userId,
      action: "sentence_generation",
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      latencyMs: usage.latencyMs,
      success: true,
      metadata: { word: vocab.word, language: vocab.language },
    });

    // Create or update the flashcard
    const flashcardId = await ctx.runMutation(internal.aiHelpers.upsertFlashcard, {
      vocabularyId: args.vocabularyId,
      userId: vocab.userId,
      sentence: generated.sentence,
      sentenceTranslation: generated.translation,
    });

    return { success: true, flashcardId };
  },
});

// ============================================
// BULK FLASHCARD GENERATION
// ============================================

// Generate flashcards for multiple vocabulary items
export const generateFlashcardsBulk = action({
  args: {
    vocabularyIds: v.array(v.id("vocabulary")),
  },
  handler: async (ctx, args): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    for (const vocabularyId of args.vocabularyIds) {
      try {
        // Get the vocabulary item
        const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
          vocabularyId,
        });

        if (!vocab) {
          failed++;
          continue;
        }

        // Check if flashcard already exists
        const existingFlashcard = await ctx.runQuery(internal.aiHelpers.getFlashcardByVocabulary, {
          vocabularyId,
        });

        if (existingFlashcard) {
          // Skip if flashcard already exists
          success++;
          continue;
        }

        // Generate the sentence
        const generated = await generateSentenceHelper({
          word: vocab.word,
          reading: vocab.reading ?? undefined,
          definitions: vocab.definitions,
          language: vocab.language,
          examLevel: vocab.examLevel ?? undefined,
        });

        // Create the flashcard
        await ctx.runMutation(internal.aiHelpers.upsertFlashcard, {
          vocabularyId,
          userId: vocab.userId,
          sentence: generated.sentence,
          sentenceTranslation: generated.translation,
        });

        success++;
      } catch (error) {
        console.error(`Failed to generate flashcard for ${vocabularyId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  },
});

// ============================================
// SENTENCE VERIFICATION (for user output practice)
// ============================================

interface VerificationResult {
  isCorrect: boolean;
  grammarScore: number;
  usageScore: number;
  naturalnessScore: number;
  overallScore: number;
  difficultyLevel: string; // "beginner" | "intermediate" | "advanced"
  difficultyExplanation: string; // Why this difficulty level
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  feedback: string;
  improvedSentence: string;
}

export const verifySentence = action({
  args: {
    sentence: v.string(),
    targetWord: v.string(),
    wordDefinitions: v.array(v.string()),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    feedbackLanguage: v.union(v.literal("en"), v.literal("ja"), v.literal("fr"), v.literal("zh")),
  },
  handler: async (ctx, args): Promise<VerificationResult> => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Spend credits before verification
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: identity.subject,
      action: "feedback",
      metadata: { targetWord: args.targetWord, sentence: args.sentence.substring(0, 50) },
    });

    const languageName = languageNames[args.language];
    const feedbackLang = args.feedbackLanguage;
    const feedbackLanguageName = uiLanguageNames[feedbackLang];
    const definitionList = args.wordDefinitions.join(", ");

    const systemPrompt = `You are a ${languageName} language teacher evaluating a student's sentence. Be encouraging but accurate in your feedback.

IMPORTANT: Provide ALL feedback, explanations, and the "improvedSentence" in ${feedbackLanguageName}. Do NOT respond in English unless the feedback language is English.

Respond ONLY with valid JSON in this exact format:
{
  "isCorrect": boolean (true if the sentence is grammatically correct and uses the word properly),
  "grammarScore": number (0-100),
  "usageScore": number (0-100, how well the target word is used),
  "naturalnessScore": number (0-100, how natural the sentence sounds to a native speaker),
  "overallScore": number (0-100),
  "difficultyLevel": "beginner" | "intermediate" | "advanced",
  "difficultyExplanation": "Brief explanation of why this difficulty level (e.g., grammar structures used, vocabulary complexity, sentence length)",
  "corrections": [
    {
      "original": "the part that needs correction",
      "corrected": "the corrected version",
      "explanation": "why this correction is needed"
    }
  ],
  "feedback": "overall feedback for the student",
  "improvedSentence": "ALWAYS provide an enhanced version - if the original is good, show a more sophisticated, varied, or native-like alternative that teaches something new"
}

DIFFICULTY LEVELS:
- "beginner": Simple grammar, basic vocabulary, short sentences, common patterns
- "intermediate": Compound sentences, varied vocabulary, some idioms, moderate complexity
- "advanced": Complex grammar, sophisticated vocabulary, nuanced expressions, native-like constructions

IMPORTANT: The "improvedSentence" field must ALWAYS contain a different sentence from the original. Even if the student's sentence is perfect, provide an alternative that:
- Uses more advanced vocabulary or grammar structures
- Shows a more idiomatic or native-like expression
- Demonstrates a different but valid way to express the same idea
This helps learners see multiple ways to express themselves and expands their language skills.`;

    const prompt = `Please evaluate this ${languageName} sentence written by a language learner:

Sentence: "${args.sentence}"

The student is trying to use the word "${args.targetWord}" which means: ${definitionList}

Evaluate the sentence for:
1. Grammar correctness
2. Proper usage of the target word
3. Natural expression

Provide detailed feedback and corrections if needed.`;

    const verificationSchema: JsonSchema = {
      name: "sentence_verification",
      schema: {
        type: "object",
        properties: {
          isCorrect: { type: "boolean" },
          grammarScore: { type: "number", minimum: 0, maximum: 100 },
          usageScore: { type: "number", minimum: 0, maximum: 100 },
          naturalnessScore: { type: "number", minimum: 0, maximum: 100 },
          overallScore: { type: "number", minimum: 0, maximum: 100 },
          difficultyLevel: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          difficultyExplanation: { type: "string" },
          corrections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original: { type: "string" },
                corrected: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["original", "corrected", "explanation"],
              additionalProperties: false,
            },
          },
          feedback: { type: "string" },
          improvedSentence: { type: "string" },
        },
        required: [
          "isCorrect",
          "grammarScore",
          "usageScore",
          "naturalnessScore",
          "overallScore",
          "difficultyLevel",
          "difficultyExplanation",
          "corrections",
          "feedback",
          "improvedSentence",
        ],
        additionalProperties: false,
      },
    };

    try {
      const { result, usage } = await callWithRetryTracked<VerificationResult>({
        prompt,
        systemPrompt,
        maxTokens: 1000,
        jsonSchema: verificationSchema,
        parse: (response) => parseJson<VerificationResult>(response),
        validate: (parsed) => {
          if (typeof parsed.overallScore !== "number") {
            return "Missing overallScore";
          }
          return null;
        },
      });

      // Log AI usage for cost tracking
      await ctx.runMutation(internal.aiUsage.log, {
        userId: identity.subject,
        action: "sentence_verification",
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        latencyMs: usage.latencyMs,
        success: true,
        metadata: { targetWord: args.targetWord, language: args.language },
      });

      return result;
    } catch (error) {
      // Log failed attempt
      await ctx.runMutation(internal.aiUsage.logError, {
        userId: identity.subject,
        action: "sentence_verification",
        model: "unknown",
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: { targetWord: args.targetWord, language: args.language },
      });

      // Return a default response if all retries fail
      return {
        isCorrect: false,
        grammarScore: 0,
        usageScore: 0,
        naturalnessScore: 0,
        overallScore: 0,
        difficultyLevel: "beginner",
        difficultyExplanation: "Unable to assess difficulty.",
        corrections: [],
        feedback: "Unable to verify sentence. Please try again.",
        improvedSentence: args.sentence,
      };
    }
  },
});

// ============================================
// AUDIO GENERATION (TTS)
// ============================================

// Generate audio for a flashcard sentence
export const generateFlashcardAudio = action({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; audioUrl?: string }> => {
    // Get the flashcard with sentence data
    const flashcard = await ctx.runQuery(internal.aiHelpers.getFlashcardWithSentence, {
      flashcardId: args.flashcardId,
    });

    if (!flashcard) {
      throw new Error("Flashcard not found");
    }

    if (!flashcard.sentenceData) {
      throw new Error("No sentence found for flashcard");
    }

    // Get vocabulary for language info
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: flashcard.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    // Require authentication - verify user owns this flashcard
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    if (flashcard.userId !== identity.subject) {
      throw new Error("Unauthorized: You don't own this flashcard");
    }

    // Spend credits before generation (2 credits for audio)
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: flashcard.userId,
      action: "audio",
      metadata: { word: vocab.word, flashcardId: args.flashcardId },
    });

    // Generate audio using Gemini TTS
    const audioResult = await generateTTSAudio(flashcard.sentenceData.sentence, vocab.language);

    if (!audioResult) {
      console.error("Failed to generate audio");
      return { success: false };
    }

    // Upload audio to storage (R2) - word-centric path
    const audioUrl = await uploadSentenceAudio(
      new Uint8Array(audioResult.audioData),
      vocab.word,
      vocab.language,
      args.flashcardId,
      audioResult.mimeType
    );

    // Update sentence with audio URL
    await ctx.runMutation(internal.aiHelpers.updateFlashcardAudio, {
      flashcardId: args.flashcardId,
      audioUrl,
    });

    return { success: true, audioUrl };
  },
});

// Generate flashcard with audio and image
export const generateFlashcardWithAudio = action({
  args: {
    vocabularyId: v.id("vocabulary"),
    includeAudio: v.optional(v.boolean()),
    includeImage: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    flashcardId?: string;
    audioUrl?: string;
    wordAudioUrl?: string;
    imageUrl?: string;
  }> => {
    // Get the vocabulary item
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: args.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary item not found");
    }

    // Generate the sentence using the helper function
    const generated = await generateSentenceHelper({
      word: vocab.word,
      reading: vocab.reading ?? undefined,
      definitions: vocab.definitions,
      language: vocab.language,
      examLevel: vocab.examLevel ?? undefined,
    });

    // Create or update the flashcard
    const flashcardId = await ctx.runMutation(internal.aiHelpers.upsertFlashcard, {
      vocabularyId: args.vocabularyId,
      userId: vocab.userId,
      sentence: generated.sentence,
      sentenceTranslation: generated.translation,
    });

    let audioUrl: string | undefined;
    let wordAudioUrl: string | undefined;
    let imageUrl: string | undefined;

    // Generate sentence audio if requested (default: true)
    if (args.includeAudio !== false) {
      try {
        const audioResult = await generateTTSAudio(generated.sentence, vocab.language);

        if (audioResult) {
          // Upload sentence audio to storage (R2) - word-centric path
          audioUrl = await uploadSentenceAudio(
            new Uint8Array(audioResult.audioData),
            vocab.word,
            vocab.language,
            flashcardId,
            audioResult.mimeType
          );

          await ctx.runMutation(internal.aiHelpers.updateFlashcardAudio, {
            flashcardId: flashcardId as Id<"flashcards">,
            audioUrl,
          });
        }
      } catch (error) {
        console.error("Sentence audio generation failed:", error);
        // Continue without audio - flashcard is still created
      }

      // Generate word-only audio
      try {
        const wordAudioResult = await generateTTSAudio(vocab.word, vocab.language);

        if (wordAudioResult) {
          // Upload word audio to storage (R2) - word-centric path
          wordAudioUrl = await uploadWordAudio(
            new Uint8Array(wordAudioResult.audioData),
            vocab.word,
            vocab.language,
            wordAudioResult.mimeType
          );

          await ctx.runMutation(internal.aiHelpers.updateFlashcardWordAudio, {
            flashcardId: flashcardId as Id<"flashcards">,
            wordAudioUrl,
          });
        }
      } catch (error) {
        console.error("Word audio generation failed:", error);
        // Continue without word audio - flashcard is still created
      }
    }

    // Generate image if requested (default: true)
    if (args.includeImage !== false) {
      try {
        const imageResult = await generateFlashcardImage(
          vocab.word,
          generated.sentence,
          vocab.language
        );

        if (imageResult) {
          // Upload image to storage (R2) - word-centric path
          imageUrl = await uploadWordImage(
            new Uint8Array(imageResult.imageData),
            vocab.word,
            vocab.language,
            flashcardId,
            imageResult.mimeType
          );

          await ctx.runMutation(internal.aiHelpers.updateFlashcardImage, {
            flashcardId: flashcardId as Id<"flashcards">,
            imageUrl,
          });
        }
      } catch (error) {
        console.error("Image generation failed:", error);
        // Continue without image - flashcard is still created
      }
    }

    // Clear the pending flag on the vocabulary item
    await ctx.runMutation(internal.aiHelpers.clearFlashcardPending, {
      vocabularyId: args.vocabularyId,
    });

    return { success: true, flashcardId, audioUrl, wordAudioUrl, imageUrl };
  },
});

// ============================================
// ENHANCE PREMADE VOCABULARY
// ============================================

/**
 * Enhance a premade vocabulary item by generating missing content
 * Content is stored in the content library (sentences, images, wordAudio tables)
 */
export const enhancePremadeVocabulary = action({
  args: {
    premadeVocabularyId: v.id("premadeVocabulary"),
    generateSentence: v.optional(v.boolean()),
    generateAudio: v.optional(v.boolean()),
    generateImage: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; generated: string[] }> => {
    // Get the premade vocabulary item
    const vocab = await ctx.runQuery(internal.aiHelpers.getPremadeVocabulary, {
      premadeVocabularyId: args.premadeVocabularyId,
    });

    if (!vocab) {
      throw new Error("Premade vocabulary item not found");
    }

    const generated: string[] = [];

    // Check existing content
    const hasSentence = !!vocab.sentenceId;
    const hasImage = !!vocab.imageId;

    // Check for word audio in content library
    const existingWordAudio = await ctx.runQuery(internal.aiHelpers.getWordAudioByWord, {
      word: vocab.word,
      language: vocab.language,
    });
    const hasWordAudio = !!existingWordAudio;

    // Check for sentence audio (if sentence exists)
    let existingSentence = null;
    let hasSentenceAudio = false;
    if (vocab.sentenceId) {
      existingSentence = await ctx.runQuery(internal.aiHelpers.getSentenceById, {
        sentenceId: vocab.sentenceId,
      });
      hasSentenceAudio = !!existingSentence?.audioUrl;
    }

    let sentence = existingSentence?.sentence;
    let sentenceTranslation = existingSentence?.translations?.en;

    // Generate sentence if missing and requested (default: true if missing)
    const shouldGenerateSentence =
      args.generateSentence === true || (args.generateSentence !== false && !hasSentence);
    if (shouldGenerateSentence) {
      const sentenceResult = await generateSentenceHelper({
        word: vocab.word,
        reading: vocab.reading ?? undefined,
        definitions: vocab.definitions,
        language: vocab.language,
        examLevel: vocab.level ?? undefined,
      });

      sentence = sentenceResult.sentence;
      sentenceTranslation = sentenceResult.translation;

      await ctx.runMutation(internal.aiHelpers.updatePremadeVocabularyContent, {
        premadeVocabularyId: args.premadeVocabularyId,
        sentence,
        sentenceTranslation,
      });

      generated.push("sentence");
    }

    // Generate audio if explicitly requested (true) or if not explicitly disabled
    const shouldGenerateAudio = args.generateAudio === true || args.generateAudio !== false;
    // For sentence audio: regenerate if explicitly requested OR if missing
    const shouldRegenerateSentenceAudio = args.generateAudio === true || !hasSentenceAudio;

    // Generate sentence audio if we have a sentence
    if (shouldGenerateAudio && sentence && shouldRegenerateSentenceAudio) {
      try {
        const audioResult = await generateTTSAudio(sentence, vocab.language);
        if (audioResult) {
          // Upload sentence audio to storage (R2) - word-centric path
          const audioUrl = await uploadSentenceAudio(
            new Uint8Array(audioResult.audioData),
            vocab.word,
            vocab.language,
            args.premadeVocabularyId,
            audioResult.mimeType
          );

          await ctx.runMutation(internal.aiHelpers.updatePremadeVocabularyContent, {
            premadeVocabularyId: args.premadeVocabularyId,
            audioUrl,
          });
          generated.push("sentenceAudio");
        }
      } catch (error) {
        console.error("Sentence audio generation failed:", error);
      }
    }

    // Generate word audio if missing
    if (shouldGenerateAudio && !hasWordAudio) {
      try {
        const wordAudioResult = await generateTTSAudio(vocab.word, vocab.language);
        if (wordAudioResult) {
          // Upload word audio to storage (R2) - word-centric path
          const wordAudioUrl = await uploadWordAudio(
            new Uint8Array(wordAudioResult.audioData),
            vocab.word,
            vocab.language,
            wordAudioResult.mimeType
          );

          await ctx.runMutation(internal.aiHelpers.updatePremadeVocabularyContent, {
            premadeVocabularyId: args.premadeVocabularyId,
            wordAudioUrl,
          });
          generated.push("wordAudio");
        }
      } catch (error) {
        console.error("Word audio generation failed:", error);
      }
    }

    // Generate image if missing and requested
    if (args.generateImage && sentence && !hasImage) {
      try {
        const imageResult = await generateFlashcardImage(vocab.word, sentence, vocab.language);
        if (imageResult) {
          // Upload image to storage (R2) - word-centric path
          const imageUrl = await uploadWordImage(
            new Uint8Array(imageResult.imageData),
            vocab.word,
            vocab.language,
            args.premadeVocabularyId,
            imageResult.mimeType
          );

          await ctx.runMutation(internal.aiHelpers.updatePremadeVocabularyContent, {
            premadeVocabularyId: args.premadeVocabularyId,
            imageUrl,
          });
          generated.push("image");
        }
      } catch (error) {
        console.error("Image generation failed:", error);
      }
    }

    return { success: true, generated };
  },
});

// ============================================
// FLASHCARD SENTENCE REFRESH
// ============================================

/**
 * Refresh a flashcard's sentence and audio with newly generated content
 */
export const refreshFlashcardSentence = action({
  args: {
    flashcardId: v.id("flashcards"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; sentence?: string; translation?: string; audioUrl?: string }> => {
    // Get the flashcard
    const flashcard = await ctx.runQuery(internal.aiHelpers.getFlashcard, {
      flashcardId: args.flashcardId,
    });

    if (!flashcard) {
      throw new Error("Flashcard not found");
    }

    // Require authentication - verify user owns this flashcard
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    if (flashcard.userId !== identity.subject) {
      throw new Error("Unauthorized: You don't own this flashcard");
    }

    // Get vocabulary for language info and word details
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: flashcard.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    // Spend credits before generation (1 credit for sentence)
    await ctx.runMutation(internal.aiHelpers.spendCreditsInternal, {
      userId: flashcard.userId,
      action: "sentence",
      metadata: { word: vocab.word, flashcardId: args.flashcardId, refresh: true },
    });

    // Generate a new sentence using the helper function
    const generated = await generateSentenceHelper({
      word: vocab.word,
      reading: vocab.reading ?? undefined,
      definitions: vocab.definitions,
      language: vocab.language,
      examLevel: vocab.examLevel ?? undefined,
    });

    let audioUrl: string | undefined;

    // Generate new audio for the sentence
    try {
      const audioResult = await generateTTSAudio(generated.sentence, vocab.language);

      if (audioResult) {
        // Upload sentence audio to storage (R2) - word-centric path
        audioUrl = await uploadSentenceAudio(
          new Uint8Array(audioResult.audioData),
          vocab.word,
          vocab.language,
          args.flashcardId,
          audioResult.mimeType
        );
      }
    } catch (error) {
      console.error("Audio generation failed during refresh:", error);
      // Continue without audio - sentence refresh is still valuable
    }

    // Update the flashcard with new sentence and audio
    await ctx.runMutation(internal.flashcards.updateSentenceInternal, {
      flashcardId: args.flashcardId,
      sentence: generated.sentence,
      sentenceTranslation: generated.translation,
      audioUrl,
    });

    return {
      success: true,
      sentence: generated.sentence,
      translation: generated.translation,
      audioUrl,
    };
  },
});

// ============================================
// INTERNAL ACTION WRAPPERS
// ============================================

/**
 * Internal action wrapper for sentence verification
 * Used by the gated generation layer
 */
interface InternalVerificationResultType {
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

export const verifySentenceInternal = internalAction({
  args: {
    userId: v.string(),
    vocabularyId: v.id("vocabulary"),
    targetWord: v.string(),
    sentence: v.string(),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
  },
  handler: async (ctx, args): Promise<InternalVerificationResultType> => {
    // Get vocabulary definitions
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: args.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    const languageName = languageNames[args.language];
    const definitionList = vocab.definitions.join(", ");

    const systemPrompt = `You are a ${languageName} language teacher evaluating a student's sentence. Be encouraging but accurate in your feedback.

Respond ONLY with valid JSON in this exact format:
{
  "isCorrect": boolean (true if the sentence is grammatically correct and uses the word properly),
  "grammarScore": number (0-100),
  "usageScore": number (0-100, how well the target word is used),
  "naturalnessScore": number (0-100, how natural the sentence sounds to a native speaker),
  "overallScore": number (0-100),
  "corrections": [
    {
      "original": "the part that needs correction",
      "corrected": "the corrected version",
      "explanation": "why this correction is needed"
    }
  ],
  "feedback": "overall feedback for the student",
  "improvedSentence": "a more sophisticated version of the sentence"
}`;

    const prompt = `Please evaluate this ${languageName} sentence written by a language learner:

Sentence: "${args.sentence}"

The student is trying to use the word "${args.targetWord}" which means: ${definitionList}

Evaluate the sentence for:
1. Grammar correctness
2. Proper usage of the target word
3. Natural expression

Provide detailed feedback and corrections if needed.`;

    const verificationSchema: JsonSchema = {
      name: "sentence_verification",
      schema: {
        type: "object",
        properties: {
          isCorrect: { type: "boolean" },
          grammarScore: { type: "number", minimum: 0, maximum: 100 },
          usageScore: { type: "number", minimum: 0, maximum: 100 },
          naturalnessScore: { type: "number", minimum: 0, maximum: 100 },
          overallScore: { type: "number", minimum: 0, maximum: 100 },
          corrections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                original: { type: "string" },
                corrected: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["original", "corrected", "explanation"],
              additionalProperties: false,
            },
          },
          feedback: { type: "string" },
          improvedSentence: { type: "string" },
        },
        required: [
          "isCorrect",
          "grammarScore",
          "usageScore",
          "naturalnessScore",
          "overallScore",
          "corrections",
          "feedback",
          "improvedSentence",
        ],
        additionalProperties: false,
      },
    };

    interface InternalVerificationResult {
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

    try {
      const result = await callWithRetry<InternalVerificationResult>({
        prompt,
        systemPrompt,
        maxTokens: 1000,
        jsonSchema: verificationSchema,
        parse: (response) => parseJson<InternalVerificationResult>(response),
        validate: (parsed) => {
          if (typeof parsed.overallScore !== "number") {
            return "Missing overallScore";
          }
          return null;
        },
      });

      // Save the verification result
      await ctx.runMutation(internal.aiHelpers.saveUserSentenceVerification, {
        userId: args.userId,
        vocabularyId: args.vocabularyId,
        targetWord: args.targetWord,
        sentence: args.sentence,
        isCorrect: result.isCorrect,
        grammarScore: result.grammarScore,
        usageScore: result.usageScore,
        naturalnessScore: result.naturalnessScore,
        overallScore: result.overallScore,
        corrections: result.corrections,
        feedback: result.feedback,
        improvedSentence: result.improvedSentence,
      });

      return result;
    } catch {
      return {
        isCorrect: false,
        grammarScore: 0,
        usageScore: 0,
        naturalnessScore: 0,
        overallScore: 0,
        corrections: [],
        feedback: "Unable to verify sentence. Please try again.",
        improvedSentence: args.sentence,
      };
    }
  },
});
