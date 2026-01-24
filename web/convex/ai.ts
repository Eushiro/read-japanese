"use node";

import { v } from "convex/values";
import { YoutubeTranscript } from "youtube-transcript";

import { internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { uploadAudio, uploadImage } from "./lib/storage";

// ============================================
// GEMINI TTS CONFIGURATION (Generative Language API)
// ============================================

const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Convert raw PCM audio data to WAV format
 * PCM specs: 24kHz sample rate, 16-bit, mono
 */
function pcmToWav(pcmData: Uint8Array): Uint8Array {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const wav = new Uint8Array(fileSize);
  const view = new DataView(wav.buffer);

  // RIFF header
  wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // File size - 8
  wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt subchunk
  wav.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1 size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  wav.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, dataSize, true);

  // PCM data
  wav.set(pcmData, headerSize);

  return wav;
}

// Consistent voice for all languages
const TTS_VOICE = "Aoede";

/**
 * Generate audio for a sentence using Gemini 2.5 Flash TTS
 * Returns PCM audio data (24kHz, 16-bit mono)
 */
async function generateTTSAudio(
  text: string,
  language: string
): Promise<{ audioData: Uint8Array; mimeType: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not configured");
    return null;
  }

  const voice = TTS_VOICE;

  // For short text (single words), add language context for correct pronunciation
  // For longer text (sentences), add a pronunciation hint
  const isShortText = text.length <= 10 || !text.includes(" ");

  let promptText: string;
  if (isShortText) {
    // Add language context for single words
    const wordHints: Record<string, string> = {
      japanese: `Pronounce this Japanese word: ${text}`,
      english: `Pronounce this English word: ${text}`,
      french: `Pronounce this French word: ${text}`,
    };
    promptText = wordHints[language] || text;
  } else {
    // For sentences, add pronunciation hints
    const languageHints: Record<string, string> = {
      japanese: "Read this Japanese text clearly and naturally for language learners:",
      english: "Read this English text clearly and naturally for language learners:",
      french: "Read this French text clearly and naturally for language learners:",
    };
    const hint = languageHints[language] || languageHints.english;
    promptText = `${hint}\n\n${text}`;
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini TTS error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    // Extract audio data from response
    const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData?.data) {
      console.error("No audio data in Gemini TTS response:", JSON.stringify(result));
      return null;
    }

    // Decode base64 PCM audio (24kHz, 16-bit mono)
    const binaryString = atob(audioData.data);
    const pcmBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM to WAV for browser playback
    const wavBytes = pcmToWav(pcmBytes);

    return {
      audioData: wavBytes,
      mimeType: "audio/wav",
    };
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
}

// ============================================
// IMAGE GENERATION (OpenRouter + Gemini)
// ============================================

/**
 * Generate an image for a flashcard using OpenRouter with Gemini
 */
async function generateFlashcardImage(
  word: string,
  sentence: string,
  language: string
): Promise<{ imageData: Uint8Array; mimeType: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not configured");
    return null;
  }

  const languageNames: Record<string, string> = {
    japanese: "Japanese",
    english: "English",
    french: "French",
  };
  const languageName = languageNames[language] || "English";

  const prompt = `Generate an illustration that helps a language learner remember this ${languageName} vocabulary word: "${word}"

Context sentence: "${sentence}"

The image should:
- Be a clear, memorable visual representation of the word's meaning
- Use a simple, clean art style suitable for educational flashcards
- Avoid any text in the image
- Be colorful but not cluttered`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://sanlang.app",
        "X-Title": "SanLang",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
        // Square aspect ratio for flashcards
        image_generation_config: {
          aspect_ratio: "1:1",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Image generation error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log("Image generation response:", JSON.stringify(result, null, 2));

    // Check for images array in the response (OpenRouter format)
    const images = result.choices?.[0]?.message?.images;
    if (images && images.length > 0) {
      const imageUrl = images[0]?.image_url?.url;
      if (imageUrl && imageUrl.startsWith("data:image/")) {
        const base64Match = imageUrl.match(/data:image\/(\w+);base64,(.+)/);
        if (base64Match) {
          const mimeType = `image/${base64Match[1]}`;
          const base64Data = base64Match[2];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return {
            imageData: bytes,
            mimeType,
          };
        }
      }
    }

    // Fallback: Check content for base64 data URL
    const content = result.choices?.[0]?.message?.content;
    if (content && typeof content === "string") {
      const base64Match = content.match(/data:image\/(\w+);base64,([A-Za-z0-9+/=]+)/);
      if (base64Match) {
        const mimeType = `image/${base64Match[1]}`;
        const base64Data = base64Match[2];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return {
          imageData: bytes,
          mimeType,
        };
      }
    }

    console.error("No image data found in response");
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
}

// ============================================
// OPENROUTER CONFIGURATION
// ============================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Model configuration - ordered by preference (primary first, then fallbacks)
const MODEL_CHAIN = [
  "google/gemini-3-flash-preview", // Primary: fast and cheap
  "anthropic/claude-haiku-4.5", // Fallback: reliable structured output
];

// For backward compatibility
const DEFAULT_MODEL = MODEL_CHAIN[0];

interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: string = DEFAULT_MODEL,
  maxTokens: number = 500,
  jsonSchema?: JsonSchema
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  // Enable structured JSON output with schema for Gemini
  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.name,
        strict: true,
        schema: jsonSchema.schema,
      },
    };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://sanlang.app",
      "X-Title": "SanLang",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content ?? "";
}

/**
 * Clean JSON response - strips markdown code blocks and whitespace
 */
function cleanJsonResponse(response: string): string {
  let cleaned = response.trim();
  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

/**
 * Parse JSON response with automatic cleanup
 */
function parseJson<T>(response: string): T {
  const cleaned = cleanJsonResponse(response);
  return JSON.parse(cleaned) as T;
}

interface CallWithRetryOptions<T> {
  prompt: string;
  systemPrompt: string;
  maxTokens?: number;
  jsonSchema?: JsonSchema;
  /** Parse the response string into the expected type */
  parse: (response: string) => T;
  /** Optional validation - return error message if invalid, null if valid */
  validate?: (parsed: T) => string | null;
  /** Model chain to try (defaults to MODEL_CHAIN) */
  models?: string[];
}

/**
 * Call OpenRouter with automatic retry through model chain
 * Retries on API errors AND validation failures
 */
async function callWithRetry<T>(options: CallWithRetryOptions<T>): Promise<T> {
  const {
    prompt,
    systemPrompt,
    maxTokens = 500,
    jsonSchema,
    parse,
    validate,
    models = MODEL_CHAIN,
  } = options;

  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isRetry = i > 0;

    if (isRetry) {
      console.log(`Retrying with model: ${model}`);
    }

    try {
      const response = await callOpenRouter(prompt, systemPrompt, model, maxTokens, jsonSchema);
      const parsed = parse(response);

      // Run validation if provided
      if (validate) {
        const validationError = validate(parsed);
        if (validationError) {
          console.warn(`Validation failed for model ${model}: ${validationError}`);
          lastError = new Error(validationError);
          continue; // Try next model
        }
      }

      return parsed;
    } catch (error) {
      console.error(`Model ${model} failed:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error(`Failed after trying ${models.length} models`);
}

// ============================================
// SENTENCE GENERATION
// ============================================

interface SentenceTranslations {
  en?: string;
  ja?: string;
  fr?: string;
  zh?: string;
}

interface GeneratedSentence {
  sentence: string;
  translation: string; // Kept for backwards compatibility (English)
  translations: SentenceTranslations; // All UI language translations
}

const languageNames: Record<string, string> = {
  japanese: "Japanese",
  english: "English",
  french: "French",
};

// Helper function to generate sentence (not a Convex action)
async function generateSentenceHelper(args: {
  word: string;
  reading?: string;
  definitions: string[];
  language: "japanese" | "english" | "french";
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

  interface RawGeneratedSentence {
    sentence: string;
    translations: SentenceTranslations;
  }

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

// Generate an example sentence for a vocabulary word (public action)
export const generateSentence = action({
  args: {
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    examLevel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GeneratedSentence> => {
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
  handler: async (ctx, args): Promise<GeneratedSentence> => {
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
  },
  handler: async (ctx, args): Promise<VerificationResult> => {
    const languageNames: Record<string, string> = {
      japanese: "Japanese",
      english: "English",
      french: "French",
    };

    const languageName = languageNames[args.language];
    const definitionList = args.wordDefinitions.join(", ");

    const systemPrompt = `You are a ${languageName} language teacher evaluating a student's sentence. Be encouraging but accurate in your feedback.

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
      return await callWithRetry<VerificationResult>({
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
    } catch {
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

    // Generate audio using Gemini TTS
    const audioResult = await generateTTSAudio(flashcard.sentenceData.sentence, vocab.language);

    if (!audioResult) {
      console.error("Failed to generate audio");
      return { success: false };
    }

    // Upload audio to storage (R2)
    const audioUrl = await uploadAudio(new Uint8Array(audioResult.audioData), audioResult.mimeType);

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
          // Upload audio to storage (R2)
          audioUrl = await uploadAudio(new Uint8Array(audioResult.audioData), audioResult.mimeType);

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
          // Upload word audio to storage (R2)
          wordAudioUrl = await uploadAudio(
            new Uint8Array(wordAudioResult.audioData),
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
          // Upload image to storage (R2)
          imageUrl = await uploadImage(new Uint8Array(imageResult.imageData), imageResult.mimeType);

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
            // Upload audio to storage (R2)
            const audioUrl = await uploadAudio(
              new Uint8Array(audioResult.audioData),
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
            // Upload word audio to storage (R2)
            const wordAudioUrl = await uploadAudio(
              new Uint8Array(wordAudioResult.audioData),
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
            // Upload image to storage (R2)
            const imageUrl = await uploadImage(
              new Uint8Array(imageResult.imageData),
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
// STORY COMPREHENSION QUESTIONS
// ============================================

interface ComprehensionQuestion {
  questionId: string;
  type:
    | "multiple_choice"
    | "translation"
    | "short_answer"
    | "inference"
    | "prediction"
    | "grammar"
    | "opinion";
  question: string;
  questionTranslation?: string;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  relatedChapter?: number;
  points: number;
}

/**
 * Generate comprehension questions for a story
 * Questions are cached per story/difficulty in storyQuestions table
 */
export const generateComprehensionQuestions = action({
  args: {
    storyId: v.string(),
    storyTitle: v.string(),
    storyContent: v.string(), // Full story text (plain text, not JSON)
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    userId: v.string(),
    difficulty: v.number(), // 1-6 scale (required for caching)
    userLevel: v.optional(v.string()), // User's proficiency level (N3, B2, etc.) for display
  },
  handler: async (
    ctx,
    args
  ): Promise<{ comprehensionId: string; questions: ComprehensionQuestion[] }> => {
    // First, check if questions are cached for this story/difficulty
    const cachedQuestions = await ctx.runQuery(internal.storyQuestions.getForStoryInternal, {
      storyId: args.storyId,
      difficulty: args.difficulty,
    });

    if (cachedQuestions) {
      // Questions exist - create user's comprehension quiz from cached questions
      const questionsWithIds = cachedQuestions.questions.map(
        (q: (typeof cachedQuestions.questions)[number], index: number) => ({
          ...q,
          questionId: `q_${Date.now()}_${index}`,
        })
      );

      const comprehensionId = await ctx.runMutation(internal.storyComprehension.createFromAI, {
        userId: args.userId,
        storyId: args.storyId,
        storyTitle: args.storyTitle,
        language: args.language,
        questions: questionsWithIds,
      });

      return { comprehensionId: comprehensionId as string, questions: questionsWithIds };
    }

    // No cached questions - generate new ones
    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The learner is at ${args.userLevel} level.` : "";

    // Grammar examples for Japanese
    const grammarExamples =
      args.language === "japanese"
        ? `
- Grammar implication questions: Test understanding of nuances like:
  - 〜たい (want to do)
  - はず (expectation/should be)
  - 〜てしまう (completion/regret)
  - 〜ようにする (try to/make sure to)
  - Passive vs causative forms
  - Conditional forms (〜たら, 〜ば, 〜なら)`
        : "";

    // Work budget system: aim for ~6 work units total
    // This creates variety - could be 6 easy questions or 2 hard ones
    const workBudget = 6;

    const systemPrompt = `You are a language learning assistant creating comprehension questions for a ${languageName} reading passage.${levelInfo}

Create questions with a MIX of difficulty levels. Each question type has a "work cost":
- multiple_choice: 1 work (quick to answer)
- translation: 2 work (requires writing)
- short_answer: 2 work (requires brief written response)
- inference: 2 work (requires thinking + brief answer)
- prediction: 2 work (creative thinking + brief answer)
- grammar: 2 work (analyze grammar usage)
- opinion: 3 work (requires longer thoughtful response)

Your TOTAL work must equal approximately ${workBudget}. Examples:
- 6 multiple choice (6 work)
- 3 multiple choice + 1 opinion (6 work)
- 2 multiple choice + 2 translation (6 work)
- 1 multiple choice + 1 translation + 1 opinion (6 work)

Question type details:
1. multiple_choice: Facts, details, or sequence of events (4 options)
2. translation: Translate a sentence/phrase from the story
3. short_answer: Brief response about meaning or context
4. inference: What can we infer about a character or situation?
5. prediction: What happens next? What would character do if...?
6. grammar: How does a grammar pattern affect meaning?${grammarExamples}
7. opinion: Learner's opinion about character decision or theme

CRITICAL RULES - FOLLOW EXACTLY:
1. Output ONLY the JSON object - nothing else
2. For multiple_choice: MUST include correctAnswer (the exact text of one option), and options array with 4 choices
3. For multiple_choice: Do NOT include rubric field at all
4. For opinion/short_answer: rubric must be under 50 characters (e.g. "clear opinion, evidence")
5. correctAnswer must be under 100 characters
6. NEVER put explanations, reasoning, or thoughts in ANY field
7. Vary question types

JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question in ${languageName}",
      "questionTranslation": "English translation",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "points": 10
    },
    {
      "type": "opinion",
      "question": "What do you think?",
      "questionTranslation": "English translation",
      "rubric": "opinion, evidence, clarity",
      "points": 25
    }
  ]
}`;

    const prompt = `Story Title: ${args.storyTitle}

${args.storyContent}

---
Create comprehension questions for the story above, aiming for a total of ${workBudget} work units.`;

    const comprehensionSchema: JsonSchema = {
      name: "comprehension_questions",
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "multiple_choice",
                    "translation",
                    "short_answer",
                    "inference",
                    "prediction",
                    "grammar",
                    "opinion",
                  ],
                },
                question: { type: "string", maxLength: 500 },
                questionTranslation: { type: "string", maxLength: 500 },
                options: { type: "array", items: { type: "string", maxLength: 100 } },
                correctAnswer: { type: "string", maxLength: 500 },
                rubric: { type: "string", maxLength: 150 },
                points: { type: "number" },
              },
              required: ["type", "question", "points"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    };

    // Helper to sanitize and process questions
    const processQuestions = (parsed: {
      questions: Omit<ComprehensionQuestion, "questionId">[];
    }): ComprehensionQuestion[] => {
      return parsed.questions.map((q, index) => ({
        ...q,
        questionId: `q_${Date.now()}_${index}`,
        // For multiple_choice, rubric is not needed - remove it entirely
        // For other types, keep it short
        rubric:
          q.type === "multiple_choice" ? undefined : q.rubric ? q.rubric.slice(0, 150) : undefined,
        // Truncate answer fields
        correctAnswer: q.correctAnswer ? q.correctAnswer.slice(0, 300) : undefined,
      }));
    };

    const parsed = await callWithRetry<{ questions: Omit<ComprehensionQuestion, "questionId">[] }>({
      prompt,
      systemPrompt,
      maxTokens: 1500,
      jsonSchema: comprehensionSchema,
      parse: (response) => parseJson(response),
      validate: (parsed) => {
        if (!parsed.questions || parsed.questions.length === 0) {
          return "No questions generated";
        }
        // Check for corrupted fields (AI dumping chain of thought)
        const corrupted = parsed.questions.some(
          (q) =>
            (q.rubric && q.rubric.length > 200) || (q.correctAnswer && q.correctAnswer.length > 300)
        );
        if (corrupted) {
          return "Response contains corrupted fields (overly long rubric or correctAnswer)";
        }
        // Validate multiple_choice questions have required fields
        const invalidMC = parsed.questions.some(
          (q) =>
            q.type === "multiple_choice" &&
            (!q.correctAnswer ||
              q.correctAnswer.trim() === "" ||
              !q.options ||
              q.options.length < 2)
        );
        if (invalidMC) {
          return "Multiple choice questions must have correctAnswer and options";
        }
        return null;
      },
    });

    const questionsWithIds = processQuestions(parsed);

    // Save questions to cache (storyQuestions table)
    await ctx.runMutation(internal.storyQuestions.createFromAI, {
      storyId: args.storyId,
      difficulty: args.difficulty,
      language: args.language,
      questions: questionsWithIds,
    });

    // Create the comprehension quiz for this user
    const comprehensionId = await ctx.runMutation(internal.storyComprehension.createFromAI, {
      userId: args.userId,
      storyId: args.storyId,
      storyTitle: args.storyTitle,
      language: args.language,
      questions: questionsWithIds,
    });

    return { comprehensionId: comprehensionId as string, questions: questionsWithIds };
  },
});

/**
 * Grade a free-form comprehension answer (short answer, essay, translation, inference, etc.)
 */
export const gradeComprehensionAnswer = action({
  args: {
    comprehensionId: v.id("storyComprehension"),
    questionIndex: v.number(),
    userAnswer: v.string(),
    question: v.string(),
    questionType: v.union(
      v.literal("short_answer"),
      v.literal("essay"),
      v.literal("translation"),
      v.literal("inference"),
      v.literal("prediction"),
      v.literal("grammar"),
      v.literal("opinion")
    ),
    expectedAnswer: v.optional(v.string()), // For short answer, translation, grammar
    rubric: v.optional(v.string()), // For essay, inference, prediction, opinion
    storyContext: v.string(), // Relevant story content for context
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    userLevel: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    aiScore: number;
    aiFeedback: string;
    isCorrect: boolean;
    possibleAnswer: string;
  }> => {
    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The student is at ${args.userLevel} level.` : "";

    let gradingInstructions = "";
    const questionTypeLabels: Record<string, string> = {
      short_answer: "short answer",
      essay: "essay",
      translation: "translation",
      inference: "inference",
      prediction: "prediction",
      grammar: "grammar",
      opinion: "opinion",
    };
    const typeLabel = questionTypeLabels[args.questionType] || args.questionType;

    if (
      (args.questionType === "short_answer" ||
        args.questionType === "translation" ||
        args.questionType === "grammar") &&
      args.expectedAnswer
    ) {
      gradingInstructions = `Expected answer (or key points): ${args.expectedAnswer}

Grade based on:
- Accuracy of content (does it match the expected answer?)
- Completeness (are all key points addressed?)
- Language quality (for the student's level)`;
    } else if (
      (args.questionType === "essay" ||
        args.questionType === "inference" ||
        args.questionType === "prediction" ||
        args.questionType === "opinion") &&
      args.rubric
    ) {
      gradingInstructions = `Grading rubric: ${args.rubric}`;
    } else if (args.expectedAnswer) {
      gradingInstructions = `Expected answer (or key points): ${args.expectedAnswer}`;
    } else if (args.rubric) {
      gradingInstructions = `Grading rubric: ${args.rubric}`;
    }

    const systemPrompt = `You are a ${languageName} language teacher grading a student's comprehension answer.${levelInfo}

${gradingInstructions}

IMPORTANT LANGUAGE REQUIREMENT:
- Students MUST respond in ${languageName}
- If the student answers in a different language (e.g., English instead of ${languageName}), deduct 20-30 points from their score
- In your feedback, remind them to answer in ${languageName} next time

Respond ONLY with valid JSON in this exact format:
{
  "aiScore": number (0-100),
  "aiFeedback": "detailed feedback IN ENGLISH for the student including what they did well and how to improve",
  "isCorrect": boolean (true if score >= 70),
  "possibleAnswer": "a sample correct answer written IN ${languageName.toUpperCase()} at the student's level"
}

Be encouraging but accurate. Consider:
1. Language used - did they respond in ${languageName}? (Major penalty if not)
2. Content accuracy - does the answer demonstrate understanding?
3. Completeness - are key points addressed?
4. Language quality - grammar, vocabulary appropriate for the student's level`;

    const prompt = `Grade this ${typeLabel} answer:

Question: ${args.question}

Student's answer: "${args.userAnswer}"

Story context (for reference):
${args.storyContext}

Provide a score (0-100), detailed feedback in English, and a possible answer in ${languageName}.`;

    const gradingSchema: JsonSchema = {
      name: "comprehension_grading",
      schema: {
        type: "object",
        properties: {
          aiScore: { type: "number", minimum: 0, maximum: 100 },
          aiFeedback: {
            type: "string",
            description: "Detailed feedback for the student in English",
          },
          isCorrect: { type: "boolean", description: "True if score >= 70" },
          possibleAnswer: {
            type: "string",
            description: `A sample correct answer written in ${languageName}`,
          },
        },
        required: ["aiScore", "aiFeedback", "isCorrect", "possibleAnswer"],
        additionalProperties: false,
      },
    };

    try {
      const parsed = await callWithRetry<{
        aiScore: number;
        aiFeedback: string;
        isCorrect: boolean;
        possibleAnswer: string;
      }>({
        prompt,
        systemPrompt,
        maxTokens: 500,
        jsonSchema: gradingSchema,
        parse: (response) => parseJson(response),
        validate: (parsed) => {
          if (typeof parsed.aiScore !== "number") {
            return "Missing aiScore";
          }
          return null;
        },
      });

      // Update the comprehension quiz with the grading
      await ctx.runMutation(internal.storyComprehension.updateGradingFromAI, {
        comprehensionId: args.comprehensionId,
        questionIndex: args.questionIndex,
        aiScore: parsed.aiScore,
        aiFeedback: parsed.aiFeedback,
        isCorrect: parsed.isCorrect,
        possibleAnswer: parsed.possibleAnswer,
      });

      return parsed;
    } catch (error) {
      console.error("Failed to grade answer after retries:", error);
      return {
        aiScore: 0,
        aiFeedback: "Unable to grade answer. Please try again.",
        isCorrect: false,
        possibleAnswer: "",
      };
    }
  },
});

// ============================================
// PLACEMENT TEST QUESTION GENERATION
// ============================================

interface PlacementQuestion {
  questionId: string;
  level: string;
  type: "vocabulary" | "grammar" | "reading" | "listening";
  question: string;
  questionTranslation: string;
  options: string[];
  correctAnswer: string;
  difficulty: number;
}

// Map difficulty (-3 to +3) to level names
function difficultyToLevel(difficulty: number, language: string): string {
  if (language === "japanese") {
    if (difficulty < -1.5) return "N5";
    if (difficulty < -0.5) return "N4";
    if (difficulty < 0.5) return "N3";
    if (difficulty < 1.5) return "N2";
    return "N1";
  } else {
    // CEFR for English/French
    if (difficulty < -2.0) return "A1";
    if (difficulty < -1.0) return "A2";
    if (difficulty < 0.0) return "B1";
    if (difficulty < 1.0) return "B2";
    if (difficulty < 2.0) return "C1";
    return "C2";
  }
}

/**
 * Generate a placement test question at a specific difficulty level
 */
export const generatePlacementQuestion = action({
  args: {
    testId: v.id("placementTests"),
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    targetDifficulty: v.number(), // -3 to +3 scale
    questionType: v.union(
      v.literal("vocabulary"),
      v.literal("grammar"),
      v.literal("reading"),
      v.literal("listening")
    ),
    previousQuestions: v.optional(v.array(v.string())), // To avoid duplicates
  },
  handler: async (ctx, args): Promise<PlacementQuestion> => {
    const languageName = languageNames[args.language];
    const level = difficultyToLevel(args.targetDifficulty, args.language);

    const previousQuestionsNote = args.previousQuestions?.length
      ? `\n\nIMPORTANT: Do NOT generate questions similar to these (already asked):\n${args.previousQuestions.slice(-5).join("\n")}`
      : "";

    const systemPrompt = `You are a ${languageName} language proficiency test creator. Generate a ${args.questionType} question appropriate for ${level} level learners.

The question should test ${args.questionType} at ${level} level difficulty.

${
  args.questionType === "vocabulary"
    ? `
For VOCABULARY questions:
- Test recognition/meaning of words at ${level} level
- Use words that are commonly tested at this level
- Include context clues when appropriate`
    : ""
}

${
  args.questionType === "grammar"
    ? `
For GRAMMAR questions:
- Test grammar patterns appropriate for ${level} level
- Use conjugations, particles, or sentence structures at this level
- Provide clear context for the grammar point`
    : ""
}

${
  args.questionType === "reading"
    ? `
For READING questions:
- Provide a short passage (2-3 sentences) at ${level} level
- Ask a comprehension question about the passage
- Test understanding of main ideas or details`
    : ""
}

Respond ONLY with valid JSON in this exact format:
{
  "question": "the question text in ${languageName}",
  "questionTranslation": "English translation of the question",
  "options": ["option A", "option B", "option C", "option D"],
  "correctAnswer": "the exact text of the correct option",
  "explanation": "brief explanation of why this is the correct answer"
}

IMPORTANT:
- All options must be plausible distractors
- The correct answer must EXACTLY match one of the options
- Questions should clearly test ${level} level knowledge${previousQuestionsNote}`;

    const prompt = `Generate a ${args.questionType} question for a ${languageName} placement test at ${level} level (difficulty: ${args.targetDifficulty.toFixed(1)}).`;

    const placementSchema: JsonSchema = {
      name: "placement_question",
      schema: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question text in the target language" },
          questionTranslation: {
            type: "string",
            description: "English translation of the question",
          },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correctAnswer: { type: "string", description: "Must exactly match one of the options" },
          explanation: { type: "string", description: "Brief explanation of the correct answer" },
        },
        required: ["question", "questionTranslation", "options", "correctAnswer"],
        additionalProperties: false,
      },
    };

    // Helper to parse and fix response
    const parseResponse = (response: string) => {
      if (!response || response.trim() === "") {
        throw new Error("Empty response from AI");
      }

      const parsed = parseJson<{
        question: string;
        questionTranslation: string;
        options: string[];
        correctAnswer: string;
      }>(response);

      // Fix correctAnswer if not in options
      if (!parsed.options.includes(parsed.correctAnswer)) {
        const match = parsed.options.find(
          (o) =>
            o.toLowerCase().includes(parsed.correctAnswer.toLowerCase()) ||
            parsed.correctAnswer.toLowerCase().includes(o.toLowerCase())
        );
        if (match) {
          parsed.correctAnswer = match;
        } else {
          parsed.options[0] = parsed.correctAnswer;
        }
      }

      return parsed;
    };

    const parsed = await callWithRetry({
      prompt,
      systemPrompt,
      maxTokens: 500,
      jsonSchema: placementSchema,
      parse: parseResponse,
      validate: (parsed) => {
        if (!parsed.question || !parsed.options || parsed.options.length !== 4) {
          return "Invalid question format";
        }
        return null;
      },
    });

    const questionData: PlacementQuestion = {
      questionId: `pq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      type: args.questionType,
      question: parsed.question,
      questionTranslation: parsed.questionTranslation,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      difficulty: args.targetDifficulty,
    };

    // Add the question to the test
    await ctx.runMutation(internal.placementTest.addQuestionFromAI, {
      testId: args.testId,
      question: questionData,
    });

    return questionData;
  },
});

/**
 * Calculate the next optimal difficulty for CAT
 * Based on current ability estimate
 */
export const getNextQuestionDifficulty = action({
  args: {
    testId: v.id("placementTests"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    targetDifficulty: number;
    suggestedType: "vocabulary" | "grammar" | "reading";
    shouldContinue: boolean;
    reason?: string;
  }> => {
    // Get the current test state
    const test = await ctx.runQuery(internal.aiHelpers.getPlacementTest, {
      testId: args.testId,
    });

    if (!test || test.status !== "in_progress") {
      return {
        targetDifficulty: 0,
        suggestedType: "vocabulary",
        shouldContinue: false,
        reason: "Test not found or not in progress",
      };
    }

    // Check stopping conditions
    const MAX_QUESTIONS = 20;
    const MIN_QUESTIONS = 8;
    const SE_THRESHOLD = 0.4; // Standard error threshold for confidence

    if (test.questionsAnswered >= MAX_QUESTIONS) {
      return {
        targetDifficulty: 0,
        suggestedType: "vocabulary",
        shouldContinue: false,
        reason: "Maximum questions reached",
      };
    }

    if (test.questionsAnswered >= MIN_QUESTIONS && test.abilityStandardError < SE_THRESHOLD) {
      return {
        targetDifficulty: 0,
        suggestedType: "vocabulary",
        shouldContinue: false,
        reason: "Sufficient confidence reached",
      };
    }

    // Calculate optimal difficulty based on test progress
    // Start easy and increase difficulty based on performance
    let targetDifficulty: number;
    if (test.questionsAnswered === 0) {
      // First question: start at lower-middle level (N4 for Japanese, A2 for CEFR)
      targetDifficulty = -1.0;
    } else if (test.questionsAnswered < 3) {
      // Early questions: slightly above current ability but capped low
      targetDifficulty = Math.min(0, test.currentAbilityEstimate + 0.3);
    } else {
      // After initial questions: normal CAT behavior
      targetDifficulty = test.currentAbilityEstimate + 0.3 + (Math.random() * 0.4 - 0.2);
    }
    const clampedDifficulty = Math.max(-3, Math.min(3, targetDifficulty));

    // Cycle through question types
    const typeCycle: Array<"vocabulary" | "grammar" | "reading"> = [
      "vocabulary",
      "grammar",
      "reading",
      "vocabulary",
      "grammar",
    ];
    const suggestedType = typeCycle[test.questionsAnswered % typeCycle.length];

    return {
      targetDifficulty: clampedDifficulty,
      suggestedType,
      shouldContinue: true,
    };
  },
});

// ============================================
// YOUTUBE VIDEO TRANSCRIPT & QUESTIONS
// ============================================

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

interface VideoQuestion {
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string;
  timestamp?: number;
}

/**
 * Fetch YouTube video transcript
 * Uses youtube-transcript library to get subtitles/captions
 */
export const fetchYoutubeTranscript = action({
  args: {
    videoId: v.string(),
    youtubeContentId: v.optional(v.id("youtubeContent")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; segmentCount: number; error?: string }> => {
    try {
      // Fetch transcript from YouTube
      const transcriptItems = await YoutubeTranscript.fetchTranscript(args.videoId);

      if (!transcriptItems || transcriptItems.length === 0) {
        return {
          success: false,
          segmentCount: 0,
          error: "No transcript available for this video",
        };
      }

      // Convert to our format
      const transcript: TranscriptSegment[] = transcriptItems.map((item) => ({
        text: item.text,
        start: item.offset / 1000, // Convert ms to seconds
        duration: item.duration / 1000,
      }));

      // Update the video with transcript if ID provided
      if (args.youtubeContentId) {
        await ctx.runMutation(internal.youtubeContent.updateTranscriptInternal, {
          id: args.youtubeContentId,
          transcript,
        });
      }

      return {
        success: true,
        segmentCount: transcript.length,
      };
    } catch (error) {
      console.error("Error fetching YouTube transcript:", error);
      return {
        success: false,
        segmentCount: 0,
        error: error instanceof Error ? error.message : "Failed to fetch transcript",
      };
    }
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

    // Get vocabulary for language info and word details
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: flashcard.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

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
        // Upload audio to storage (R2)
        audioUrl = await uploadAudio(new Uint8Array(audioResult.audioData), audioResult.mimeType);
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

/**
 * Generate comprehension questions for a YouTube video based on its transcript
 */
export const generateVideoQuestions = action({
  args: {
    youtubeContentId: v.id("youtubeContent"),
    transcriptText: v.string(), // Full transcript text
    language: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    videoTitle: v.string(),
    userLevel: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; questionCount: number; error?: string }> => {
    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The learner is at ${args.userLevel} level.` : "";

    // Work budget system for video questions (slightly smaller than stories since videos are shorter)
    const workBudget = 4;

    const systemPrompt = `You are a language learning assistant creating comprehension questions for a ${languageName} video transcript.${levelInfo}

This is a listening comprehension exercise. Create questions that test understanding of the video content.

Each question type has a "work cost":
- multiple_choice: 1 work (quick to answer)
- short_answer: 2 work (requires brief written response)
- inference: 2 work (requires thinking about what was said)

Your TOTAL work must equal approximately ${workBudget}. Examples:
- 4 multiple choice (4 work)
- 2 multiple choice + 1 short_answer (4 work)
- 2 short_answer (4 work)

CRITICAL RULES:
1. Output ONLY valid JSON
2. For multiple_choice: MUST include correctAnswer and options array with 4 choices
3. Base questions on specific parts of the transcript
4. Include timestamp (in seconds) for relevant video section

JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question in ${languageName}",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "B",
      "timestamp": 30
    }
  ]
}`;

    const prompt = `Video Title: ${args.videoTitle}

Transcript:
${args.transcriptText}

---
Create comprehension questions for the video above, aiming for ${workBudget} work units total.`;

    const videoQuestionSchema: JsonSchema = {
      name: "video_questions",
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["multiple_choice", "short_answer", "inference"] },
                question: { type: "string", maxLength: 500 },
                options: { type: "array", items: { type: "string", maxLength: 100 } },
                correctAnswer: { type: "string", maxLength: 200 },
                timestamp: { type: "number" },
              },
              required: ["type", "question"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    };

    try {
      const parsed = await callWithRetry<{ questions: VideoQuestion[] }>({
        prompt,
        systemPrompt,
        maxTokens: 1000,
        jsonSchema: videoQuestionSchema,
        parse: (response) => parseJson(response),
        validate: (parsed) => {
          if (!parsed.questions || parsed.questions.length === 0) {
            return "No questions generated";
          }
          // Validate multiple_choice questions
          const invalidMC = parsed.questions.some(
            (q) =>
              q.type === "multiple_choice" &&
              (!q.correctAnswer || !q.options || q.options.length < 2)
          );
          if (invalidMC) {
            return "Multiple choice questions must have correctAnswer and options";
          }
          return null;
        },
      });

      // Update the video with questions
      await ctx.runMutation(internal.youtubeContent.updateQuestionsInternal, {
        id: args.youtubeContentId,
        questions: parsed.questions,
      });

      return {
        success: true,
        questionCount: parsed.questions.length,
      };
    } catch (error) {
      console.error("Error generating video questions:", error);
      return {
        success: false,
        questionCount: 0,
        error: error instanceof Error ? error.message : "Failed to generate questions",
      };
    }
  },
});

// ============================================
// SHADOWING PRACTICE (Audio-to-Audio Evaluation)
// ============================================

interface ShadowingFeedback {
  accuracyScore: number; // 0-100
  feedbackText: string;
  feedbackAudioBase64?: string;
}

/**
 * Parse SSE stream and accumulate audio + text chunks
 */
// async function parseAudioStream(
//   response: Response
// ): Promise<{ textContent: string; audioData: string }> {
//   const reader = response.body?.getReader();
//   if (!reader) {
//     throw new Error("No response body");
//   }
//
//   const decoder = new TextDecoder();
//   let textContent = "";
//   let audioData = "";
//   let buffer = "";
//
//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;
//
//     buffer += decoder.decode(value, { stream: true });
//
//    // Process complete SSE events
//    const lines = buffer.split("\n");
//    buffer = lines.pop() || ""; // Keep incomplete line in buffer
//
//    for (const line of lines) {
//      if (line.startsWith("data: ")) {
//        const data = line.slice(6);
//        if (data === "[DONE]") continue;
//
//        try {
//          const parsed = JSON.parse(data);
//          const delta = parsed.choices?.[0]?.delta;
//
//          // Accumulate text content
//          if (delta?.content) {
//            textContent += delta.content;
//          }
//
//          // Accumulate audio data
//          if (delta?.audio?.data) {
//            audioData += delta.audio.data;
//          }
//        } catch {
//          // Skip malformed JSON
//        }
//      }
//    }
//  }
//
//  return { textContent, audioData };
// }

/**
 * Evaluate a user's shadowing attempt using gpt-audio-mini
 * Takes the target sentence and user's recorded audio, returns spoken + text feedback
 */
export const evaluateShadowing = action({
  args: {
    targetText: v.string(),
    targetLanguage: v.union(v.literal("japanese"), v.literal("english"), v.literal("french")),
    userAudioBase64: v.string(), // Base64 encoded audio (webm or wav)
  },
  handler: async (ctx, args): Promise<ShadowingFeedback> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    const languageName = languageNames[args.targetLanguage];

    // System prompt for the audio model
    const systemPrompt = `You are an experienced ${languageName} pronunciation coach providing detailed, constructive feedback. The student is serious about improving and needs honest, specific guidance.

The student is trying to repeat: "${args.targetText}"

Listen carefully and evaluate:
1. **Accuracy** (0-100): Be critical but fair. 90+ = near-native, 70-89 = good with minor issues, 50-69 = understandable but needs work, <50 = significant issues
2. **Specific issues**: Identify EXACTLY which sounds, words, or syllables need work
3. **Actionable advice**: Give concrete tips on mouth position, tongue placement, or practice techniques

Common issues to listen for:
- Vowel length (long vs short)
- Pitch accent and intonation patterns
- Consonant clarity
- Word boundaries and linking
- Rhythm and timing
- Missing or added sounds`;

    // JSON schema for structured output
    const shadowingSchema = {
      type: "json_schema",
      json_schema: {
        name: "shadowing_feedback",
        strict: true,
        schema: {
          type: "object",
          properties: {
            accuracyScore: {
              type: "number",
              description:
                "Pronunciation accuracy score from 0-100. 90+ = near-native, 70-89 = good with minor issues, 50-69 = understandable but needs work, <50 = significant issues",
            },
            feedbackText: {
              type: "string",
              description:
                "Detailed feedback in English: what was good, what needs work, and specific tips to improve. Be thorough, 2-4 sentences.",
            },
            spokenFeedback: {
              type: "string",
              description: `Encouraging but specific feedback in ${languageName}, 2-3 sentences. Mention one thing done well and one thing to focus on.`,
            },
          },
          required: ["accuracyScore", "feedbackText", "spokenFeedback"],
          additionalProperties: false,
        },
      },
    };

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://sanlang.app",
          "X-Title": "SanLang",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Here is my attempt at saying the sentence. Please evaluate my pronunciation.",
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: args.userAudioBase64,
                    format: "wav",
                  },
                },
              ],
            },
          ],
          response_format: shadowingSchema,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shadowing evaluation error: ${response.status} - ${errorText}`);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("Shadowing evaluation response:", JSON.stringify(result, null, 2));

      // Parse structured output
      const textContent = result.choices?.[0]?.message?.content ?? "";
      let feedbackText = "Great effort! Keep practicing.";
      let spokenFeedback = "";
      let accuracyScore = 70;

      try {
        const parsed = JSON.parse(cleanJsonResponse(textContent));
        accuracyScore = parsed.accuracyScore ?? 70;
        feedbackText = parsed.feedbackText ?? feedbackText;
        spokenFeedback = parsed.spokenFeedback ?? "";
      } catch {
        // Use defaults if JSON parsing fails
        console.error("Failed to parse shadowing feedback JSON:", textContent);
      }

      // Generate audio feedback using Gemini TTS
      let feedbackAudioBase64: string | undefined;
      if (spokenFeedback) {
        try {
          const audioResult = await generateTTSAudio(spokenFeedback, args.targetLanguage);
          if (audioResult) {
            // Convert Uint8Array to base64
            let binaryString = "";
            for (let i = 0; i < audioResult.audioData.length; i++) {
              binaryString += String.fromCharCode(audioResult.audioData[i]);
            }
            feedbackAudioBase64 = btoa(binaryString);
          }
        } catch (ttsError) {
          console.error("TTS generation failed:", ttsError);
        }
      }

      return {
        accuracyScore,
        feedbackText,
        feedbackAudioBase64,
      };
    } catch (error) {
      console.error("Shadowing evaluation failed:", error);
      // Return a graceful fallback
      return {
        accuracyScore: 0,
        feedbackText: "Unable to evaluate your recording. Please try again.",
      };
    }
  },
});

// ============================================
// EXAM ANSWER GRADING
// ============================================

interface ExamGradingResult {
  score: number; // 0-100
  isCorrect: boolean; // score >= 70
  feedback: string;
  detailedFeedback: {
    strengths: string[];
    improvements: string[];
    grammarErrors: string[];
  };
  suggestedAnswer: string;
}

/**
 * Grade an exam answer using AI
 * Supports multiple choice (simple), short answer, essay, and translation
 */
export const gradeExamAnswer = action({
  args: {
    questionText: v.string(),
    questionType: v.string(), // "multiple_choice" | "short_answer" | "essay" | "translation" | "fill_blank"
    userAnswer: v.string(),
    correctAnswer: v.optional(v.string()),
    acceptableAnswers: v.optional(v.array(v.string())),
    rubric: v.optional(v.string()),
    passageText: v.optional(v.string()), // Context for reading questions
    language: v.string(), // "japanese" | "english" | "french"
    examType: v.string(), // "jlpt_n5" | "toefl" | etc.
    maxPoints: v.number(),
  },
  handler: async (ctx, args): Promise<ExamGradingResult> => {
    // For multiple choice, just do simple comparison
    if (args.questionType === "multiple_choice") {
      const isCorrect = args.userAnswer === args.correctAnswer;
      return {
        score: isCorrect ? 100 : 0,
        isCorrect,
        feedback: isCorrect
          ? "Correct!"
          : `Incorrect. The correct answer is: ${args.correctAnswer}`,
        detailedFeedback: {
          strengths: isCorrect ? ["Correct answer selected"] : [],
          improvements: isCorrect ? [] : ["Review this topic"],
          grammarErrors: [],
        },
        suggestedAnswer: args.correctAnswer || "",
      };
    }

    // For short answer with exact match checking
    if (args.questionType === "short_answer" || args.questionType === "fill_blank") {
      const normalizedAnswer = args.userAnswer.trim().toLowerCase();
      const normalizedCorrect = (args.correctAnswer || "").trim().toLowerCase();
      const acceptableNormalized = (args.acceptableAnswers || []).map((a) =>
        a.trim().toLowerCase()
      );

      if (
        normalizedAnswer === normalizedCorrect ||
        acceptableNormalized.includes(normalizedAnswer)
      ) {
        return {
          score: 100,
          isCorrect: true,
          feedback: "Correct!",
          detailedFeedback: {
            strengths: ["Exact match"],
            improvements: [],
            grammarErrors: [],
          },
          suggestedAnswer: args.correctAnswer || "",
        };
      }

      // Fall through to AI grading for partial credit
    }

    // AI grading for essays, translations, and partial credit
    const languageName = languageNames[args.language] || "English";

    let gradingContext = "";
    if (args.correctAnswer) {
      gradingContext += `\nExpected answer: ${args.correctAnswer}`;
    }
    if (args.acceptableAnswers?.length) {
      gradingContext += `\nAlso acceptable: ${args.acceptableAnswers.join(", ")}`;
    }
    if (args.rubric) {
      gradingContext += `\nGrading rubric: ${args.rubric}`;
    }
    if (args.passageText) {
      gradingContext += `\n\nPassage context:\n${args.passageText}`;
    }

    const systemPrompt = `You are a ${languageName} language exam grader for ${args.examType.replace("_", " ").toUpperCase()}.

Grade the student's answer to this ${args.questionType.replace("_", " ")} question.
${gradingContext}

Respond ONLY with valid JSON in this exact format:
{
  "score": number (0-100),
  "isCorrect": boolean (true if score >= 70),
  "feedback": "Brief overall feedback for the student",
  "detailedFeedback": {
    "strengths": ["What the student did well"],
    "improvements": ["Areas to improve"],
    "grammarErrors": ["Specific grammar mistakes if any"]
  },
  "suggestedAnswer": "A model answer in ${languageName}"
}

Be fair but rigorous. Consider:
1. Content accuracy and completeness
2. Grammar and language usage
3. Relevance to the question
4. For ${languageName}, check proper use of language-specific features`;

    const prompt = `Question: ${args.questionText}

Student's answer: "${args.userAnswer}"

Grade this answer.`;

    const gradingSchema: JsonSchema = {
      name: "exam_grading",
      schema: {
        type: "object",
        properties: {
          score: { type: "number", minimum: 0, maximum: 100 },
          isCorrect: { type: "boolean" },
          feedback: { type: "string" },
          detailedFeedback: {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              grammarErrors: { type: "array", items: { type: "string" } },
            },
            required: ["strengths", "improvements", "grammarErrors"],
            additionalProperties: false,
          },
          suggestedAnswer: { type: "string" },
        },
        required: ["score", "isCorrect", "feedback", "detailedFeedback", "suggestedAnswer"],
        additionalProperties: false,
      },
    };

    try {
      return await callWithRetry<ExamGradingResult>({
        prompt,
        systemPrompt,
        maxTokens: 800,
        jsonSchema: gradingSchema,
        parse: (response) => parseJson<ExamGradingResult>(response),
        validate: (parsed) => {
          if (typeof parsed.score !== "number") {
            return "Missing score";
          }
          return null;
        },
      });
    } catch (error) {
      console.error("AI grading failed:", error);
      // Return a conservative fallback
      return {
        score: 50,
        isCorrect: false,
        feedback: "Unable to fully grade answer. Manual review may be needed.",
        detailedFeedback: {
          strengths: ["Attempted the question"],
          improvements: ["Unable to analyze - please review"],
          grammarErrors: [],
        },
        suggestedAnswer: args.correctAnswer || "",
      };
    }
  },
});

/**
 * Grade multiple exam answers in batch
 * More efficient for completing exams with many written answers
 */
export const gradeExamAnswersBatch = action({
  args: {
    answers: v.array(
      v.object({
        questionIndex: v.number(),
        questionText: v.string(),
        questionType: v.string(),
        userAnswer: v.string(),
        correctAnswer: v.optional(v.string()),
        acceptableAnswers: v.optional(v.array(v.string())),
        rubric: v.optional(v.string()),
        passageText: v.optional(v.string()),
        maxPoints: v.number(),
      })
    ),
    language: v.string(),
    examType: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{ questionIndex: number } & ExamGradingResult>> => {
    const results: Array<{ questionIndex: number } & ExamGradingResult> = [];

    // Grade each answer
    for (const answer of args.answers) {
      try {
        const result = await ctx.runAction(internal.ai.gradeExamAnswerInternal, {
          questionText: answer.questionText,
          questionType: answer.questionType,
          userAnswer: answer.userAnswer,
          correctAnswer: answer.correctAnswer,
          acceptableAnswers: answer.acceptableAnswers,
          rubric: answer.rubric,
          passageText: answer.passageText,
          language: args.language,
          examType: args.examType,
          maxPoints: answer.maxPoints,
        });

        results.push({
          questionIndex: answer.questionIndex,
          ...result,
        });
      } catch (error) {
        console.error(`Failed to grade question ${answer.questionIndex}:`, error);
        results.push({
          questionIndex: answer.questionIndex,
          score: 0,
          isCorrect: false,
          feedback: "Grading failed - please review manually",
          detailedFeedback: {
            strengths: [],
            improvements: [],
            grammarErrors: [],
          },
          suggestedAnswer: answer.correctAnswer || "",
        });
      }
    }

    return results;
  },
});

// Internal action for batch grading
export const gradeExamAnswerInternal = internalAction({
  args: {
    questionText: v.string(),
    questionType: v.string(),
    userAnswer: v.string(),
    correctAnswer: v.optional(v.string()),
    acceptableAnswers: v.optional(v.array(v.string())),
    rubric: v.optional(v.string()),
    passageText: v.optional(v.string()),
    language: v.string(),
    examType: v.string(),
    maxPoints: v.number(),
  },
  handler: async (ctx, args): Promise<ExamGradingResult> => {
    // Same logic as gradeExamAnswer
    if (args.questionType === "multiple_choice") {
      const isCorrect = args.userAnswer === args.correctAnswer;
      return {
        score: isCorrect ? 100 : 0,
        isCorrect,
        feedback: isCorrect
          ? "Correct!"
          : `Incorrect. The correct answer is: ${args.correctAnswer}`,
        detailedFeedback: {
          strengths: isCorrect ? ["Correct answer selected"] : [],
          improvements: isCorrect ? [] : ["Review this topic"],
          grammarErrors: [],
        },
        suggestedAnswer: args.correctAnswer || "",
      };
    }

    if (args.questionType === "short_answer" || args.questionType === "fill_blank") {
      const normalizedAnswer = args.userAnswer.trim().toLowerCase();
      const normalizedCorrect = (args.correctAnswer || "").trim().toLowerCase();
      const acceptableNormalized = (args.acceptableAnswers || []).map((a) =>
        a.trim().toLowerCase()
      );

      if (
        normalizedAnswer === normalizedCorrect ||
        acceptableNormalized.includes(normalizedAnswer)
      ) {
        return {
          score: 100,
          isCorrect: true,
          feedback: "Correct!",
          detailedFeedback: {
            strengths: ["Exact match"],
            improvements: [],
            grammarErrors: [],
          },
          suggestedAnswer: args.correctAnswer || "",
        };
      }
    }

    const languageName = languageNames[args.language] || "English";

    let gradingContext = "";
    if (args.correctAnswer) {
      gradingContext += `\nExpected answer: ${args.correctAnswer}`;
    }
    if (args.acceptableAnswers?.length) {
      gradingContext += `\nAlso acceptable: ${args.acceptableAnswers.join(", ")}`;
    }
    if (args.rubric) {
      gradingContext += `\nGrading rubric: ${args.rubric}`;
    }
    if (args.passageText) {
      gradingContext += `\n\nPassage context:\n${args.passageText}`;
    }

    const systemPrompt = `You are a ${languageName} language exam grader for ${args.examType.replace("_", " ").toUpperCase()}.

Grade the student's answer to this ${args.questionType.replace("_", " ")} question.
${gradingContext}

Respond ONLY with valid JSON:
{
  "score": number (0-100),
  "isCorrect": boolean (true if score >= 70),
  "feedback": "Brief overall feedback",
  "detailedFeedback": {
    "strengths": ["What was good"],
    "improvements": ["What to improve"],
    "grammarErrors": ["Grammar mistakes"]
  },
  "suggestedAnswer": "Model answer in ${languageName}"
}`;

    const prompt = `Question: ${args.questionText}
Student's answer: "${args.userAnswer}"`;

    const gradingSchema: JsonSchema = {
      name: "exam_grading",
      schema: {
        type: "object",
        properties: {
          score: { type: "number" },
          isCorrect: { type: "boolean" },
          feedback: { type: "string" },
          detailedFeedback: {
            type: "object",
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              grammarErrors: { type: "array", items: { type: "string" } },
            },
            required: ["strengths", "improvements", "grammarErrors"],
          },
          suggestedAnswer: { type: "string" },
        },
        required: ["score", "isCorrect", "feedback", "detailedFeedback", "suggestedAnswer"],
      },
    };

    try {
      return await callWithRetry<ExamGradingResult>({
        prompt,
        systemPrompt,
        maxTokens: 600,
        jsonSchema: gradingSchema,
        parse: (response) => parseJson<ExamGradingResult>(response),
        validate: (parsed) => {
          if (typeof parsed.score !== "number") return "Missing score";
          return null;
        },
      });
    } catch {
      return {
        score: 50,
        isCorrect: false,
        feedback: "Unable to grade - manual review needed",
        detailedFeedback: { strengths: [], improvements: [], grammarErrors: [] },
        suggestedAnswer: args.correctAnswer || "",
      };
    }
  },
});

// ============================================
// INTERNAL ACTION WRAPPERS
// ============================================
// These are used by the centralized generation layer in lib/generation.ts

/**
 * Internal action wrapper for TTS audio generation
 */
export const generateTTSAudioAction = internalAction({
  args: {
    text: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; audioUrl?: string }> => {
    const audioResult = await generateTTSAudio(args.text, args.language);

    if (!audioResult) {
      return { success: false };
    }

    // Upload audio to storage
    const audioUrl = await uploadAudio(new Uint8Array(audioResult.audioData), audioResult.mimeType);

    return { success: true, audioUrl };
  },
});

/**
 * Internal action wrapper for image generation
 */
export const generateFlashcardImageAction = internalAction({
  args: {
    word: v.string(),
    sentence: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; imageUrl?: string }> => {
    const imageResult = await generateFlashcardImage(args.word, args.sentence, args.language);

    if (!imageResult) {
      return { success: false };
    }

    // Upload image to storage
    const imageUrl = await uploadImage(new Uint8Array(imageResult.imageData), imageResult.mimeType);

    return { success: true, imageUrl };
  },
});

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

    const languageNames: Record<string, string> = {
      japanese: "Japanese",
      english: "English",
      french: "French",
    };

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
