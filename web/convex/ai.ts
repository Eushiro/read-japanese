"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

  // Language-specific pronunciation hints
  const languageHints: Record<string, string> = {
    japanese: "Read this Japanese text clearly and naturally for language learners:",
    english: "Read this English text clearly and naturally for language learners:",
    french: "Read this French text clearly and naturally for language learners:",
  };
  const hint = languageHints[language] || languageHints.english;

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
              parts: [{ text: `${hint}\n\n${text}` }],
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

// Primary model for text generation
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: string = DEFAULT_MODEL,
  maxTokens: number = 500,
  jsonMode: boolean = false
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

  // Enable structured JSON output when needed
  if (jsonMode) {
    body.response_format = { type: "json_object" };
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

// ============================================
// SENTENCE GENERATION
// ============================================

interface GeneratedSentence {
  sentence: string;
  translation: string;
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
  "translation": "the English translation"
}`;

  const prompt = `Create an example sentence for the ${languageName} word "${args.word}"${readingInfo}${levelInfo}.

The word means: ${definitionList}

Generate a natural, memorable sentence that clearly shows how to use this word. The sentence should be appropriate for language learners${levelInfo}.`;

  const response = await callOpenRouter(prompt, systemPrompt);

  try {
    // Parse the JSON response
    const parsed = JSON.parse(response) as GeneratedSentence;
    return {
      sentence: parsed.sentence,
      translation: parsed.translation,
    };
  } catch {
    // If parsing fails, try to extract from the response
    console.error("Failed to parse AI response:", response);
    throw new Error("Failed to generate sentence: Invalid AI response format");
  }
}

// Generate an example sentence for a vocabulary word (public action)
export const generateSentence = action({
  args: {
    word: v.string(),
    reading: v.optional(v.string()),
    definitions: v.array(v.string()),
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
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
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
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
        const existingFlashcard = await ctx.runQuery(
          internal.aiHelpers.getFlashcardByVocabulary,
          { vocabularyId }
        );

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
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
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

    const response = await callOpenRouter(prompt, systemPrompt);

    try {
      const parsed = JSON.parse(response) as VerificationResult;
      return parsed;
    } catch {
      console.error("Failed to parse verification response:", response);
      // Return a default response on parse failure
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
    // Get the flashcard
    const flashcard = await ctx.runQuery(internal.aiHelpers.getFlashcard, {
      flashcardId: args.flashcardId,
    });

    if (!flashcard) {
      throw new Error("Flashcard not found");
    }

    // Get vocabulary for language info
    const vocab = await ctx.runQuery(internal.aiHelpers.getVocabulary, {
      vocabularyId: flashcard.vocabularyId,
    });

    if (!vocab) {
      throw new Error("Vocabulary not found");
    }

    // Generate audio using Gemini TTS
    const audioResult = await generateTTSAudio(
      flashcard.sentence,
      vocab.language
    );

    if (!audioResult) {
      console.error("Failed to generate audio");
      return { success: false };
    }

    // Store audio in Convex file storage
    const blob = new Blob([new Uint8Array(audioResult.audioData)], { type: audioResult.mimeType });
    const storageId = await ctx.storage.store(blob);

    // Get the public URL
    const audioUrl = await ctx.storage.getUrl(storageId);

    if (!audioUrl) {
      console.error("Failed to get audio URL");
      return { success: false };
    }

    // Update flashcard with audio URL
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
  handler: async (ctx, args): Promise<{ success: boolean; flashcardId?: string; audioUrl?: string; wordAudioUrl?: string; imageUrl?: string }> => {
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
        const audioResult = await generateTTSAudio(
          generated.sentence,
          vocab.language
        );

        if (audioResult) {
          // Store audio in Convex file storage
          const blob = new Blob([new Uint8Array(audioResult.audioData)], { type: audioResult.mimeType });
          const storageId = await ctx.storage.store(blob);
          audioUrl = await ctx.storage.getUrl(storageId) ?? undefined;

          if (audioUrl) {
            await ctx.runMutation(internal.aiHelpers.updateFlashcardAudio, {
              flashcardId: flashcardId as any,
              audioUrl,
            });
          }
        }
      } catch (error) {
        console.error("Sentence audio generation failed:", error);
        // Continue without audio - flashcard is still created
      }

      // Generate word-only audio
      try {
        const wordAudioResult = await generateTTSAudio(
          vocab.word,
          vocab.language
        );

        if (wordAudioResult) {
          // Store word audio in Convex file storage
          const blob = new Blob([new Uint8Array(wordAudioResult.audioData)], { type: wordAudioResult.mimeType });
          const storageId = await ctx.storage.store(blob);
          wordAudioUrl = await ctx.storage.getUrl(storageId) ?? undefined;

          if (wordAudioUrl) {
            await ctx.runMutation(internal.aiHelpers.updateFlashcardWordAudio, {
              flashcardId: flashcardId as any,
              wordAudioUrl,
            });
          }
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
          // Store image in Convex file storage
          const blob = new Blob([new Uint8Array(imageResult.imageData)], { type: imageResult.mimeType });
          const storageId = await ctx.storage.store(blob);
          imageUrl = await ctx.storage.getUrl(storageId) ?? undefined;

          if (imageUrl) {
            await ctx.runMutation(internal.aiHelpers.updateFlashcardImage, {
              flashcardId: flashcardId as any,
              imageUrl,
            });
          }
        }
      } catch (error) {
        console.error("Image generation failed:", error);
        // Continue without image - flashcard is still created
      }
    }

    return { success: true, flashcardId, audioUrl, wordAudioUrl, imageUrl };
  },
});

// ============================================
// STORY COMPREHENSION QUESTIONS
// ============================================

interface ComprehensionQuestion {
  questionId: string;
  type: "multiple_choice" | "short_answer" | "essay";
  question: string;
  questionTranslation: string;
  options?: string[];
  correctAnswer?: string;
  rubric?: string;
  relatedChapter?: number;
  points: number;
}

/**
 * Generate comprehension questions for a story
 */
export const generateComprehensionQuestions = action({
  args: {
    storyId: v.string(),
    storyTitle: v.string(),
    storyContent: v.string(), // Full story text (plain text, not JSON)
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
    userId: v.string(),
    userLevel: v.optional(v.string()), // User's proficiency level (N3, B2, etc.)
  },
  handler: async (ctx, args): Promise<{ comprehensionId: string; questions: ComprehensionQuestion[] }> => {
    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The learner is at ${args.userLevel} level.` : "";

    // Grammar examples for Japanese
    const grammarExamples = args.language === "japanese" ? `
- Grammar implication questions: Test understanding of nuances like:
  - 〜たい (want to do)
  - はず (expectation/should be)
  - 〜てしまう (completion/regret)
  - 〜ようにする (try to/make sure to)
  - Passive vs causative forms
  - Conditional forms (〜たら, 〜ば, 〜なら)` : "";

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

Respond ONLY with valid JSON:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question in ${languageName}",
      "questionTranslation": "English translation",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "the correct option",
      "points": 10
    },
    {
      "type": "translation",
      "question": "Translate: [sentence from story]",
      "questionTranslation": "Translate this sentence to English",
      "correctAnswer": "expected translation",
      "points": 15
    },
    {
      "type": "opinion",
      "question": "What do you think about [topic]? Why?",
      "questionTranslation": "English translation",
      "rubric": "Award points for: clear opinion, supporting evidence, language quality",
      "points": 25
    }
  ]
}

IMPORTANT: Vary the question types! Don't use all multiple choice.`;

    const prompt = `Story Title: ${args.storyTitle}

${args.storyContent}

---
Create comprehension questions for the story above, aiming for a total of ${workBudget} work units.`;

    const response = await callOpenRouter(prompt, systemPrompt, DEFAULT_MODEL, 1500, true);

    try {
      const parsed = JSON.parse(response) as { questions: Omit<ComprehensionQuestion, "questionId">[] };

      // Add unique IDs to each question
      const questionsWithIds: ComprehensionQuestion[] = parsed.questions.map((q, index) => ({
        ...q,
        questionId: `q_${Date.now()}_${index}`,
      }));

      // Create the comprehension quiz in the database
      const comprehensionId = await ctx.runMutation(internal.storyComprehension.createFromAI, {
        userId: args.userId,
        storyId: args.storyId,
        storyTitle: args.storyTitle,
        language: args.language,
        questions: questionsWithIds,
      });

      return { comprehensionId: comprehensionId as string, questions: questionsWithIds };
    } catch (error) {
      console.error("Failed to parse comprehension questions:", response);
      throw new Error("Failed to generate comprehension questions: Invalid AI response format");
    }
  },
});

/**
 * Grade a free-form comprehension answer (short answer or essay)
 */
export const gradeComprehensionAnswer = action({
  args: {
    comprehensionId: v.id("storyComprehension"),
    questionIndex: v.number(),
    userAnswer: v.string(),
    question: v.string(),
    questionType: v.union(v.literal("short_answer"), v.literal("essay")),
    expectedAnswer: v.optional(v.string()), // For short answer
    rubric: v.optional(v.string()), // For essay
    storyContext: v.string(), // Relevant story content for context
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
    userLevel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ aiScore: number; aiFeedback: string; isCorrect: boolean }> => {
    const languageName = languageNames[args.language];
    const levelInfo = args.userLevel ? ` The student is at ${args.userLevel} level.` : "";

    let gradingInstructions = "";
    if (args.questionType === "short_answer" && args.expectedAnswer) {
      gradingInstructions = `Expected answer (or key points): ${args.expectedAnswer}

Grade based on:
- Accuracy of content (does it match the expected answer?)
- Completeness (are all key points addressed?)
- Language quality (for the student's level)`;
    } else if (args.questionType === "essay" && args.rubric) {
      gradingInstructions = `Grading rubric: ${args.rubric}`;
    }

    const systemPrompt = `You are a ${languageName} language teacher grading a student's comprehension answer.${levelInfo}

${gradingInstructions}

Respond ONLY with valid JSON in this exact format:
{
  "aiScore": number (0-100),
  "aiFeedback": "detailed feedback for the student including what they did well and how to improve",
  "isCorrect": boolean (true if score >= 70)
}

Be encouraging but accurate. Consider:
1. Content accuracy - does the answer demonstrate understanding?
2. Completeness - are key points addressed?
3. Language quality - appropriate for the student's level`;

    const prompt = `Grade this ${args.questionType} answer:

Question: ${args.question}

Student's answer: "${args.userAnswer}"

Story context (for reference):
${args.storyContext}

Provide a score (0-100) and detailed feedback.`;

    const response = await callOpenRouter(prompt, systemPrompt);

    try {
      const parsed = JSON.parse(response) as { aiScore: number; aiFeedback: string; isCorrect: boolean };

      // Update the comprehension quiz with the grading
      await ctx.runMutation(internal.storyComprehension.updateGradingFromAI, {
        comprehensionId: args.comprehensionId,
        questionIndex: args.questionIndex,
        aiScore: parsed.aiScore,
        aiFeedback: parsed.aiFeedback,
        isCorrect: parsed.isCorrect,
      });

      return parsed;
    } catch (error) {
      console.error("Failed to parse grading response:", response);
      return {
        aiScore: 0,
        aiFeedback: "Unable to grade answer. Please try again.",
        isCorrect: false,
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
    language: v.union(
      v.literal("japanese"),
      v.literal("english"),
      v.literal("french")
    ),
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

${args.questionType === "vocabulary" ? `
For VOCABULARY questions:
- Test recognition/meaning of words at ${level} level
- Use words that are commonly tested at this level
- Include context clues when appropriate` : ""}

${args.questionType === "grammar" ? `
For GRAMMAR questions:
- Test grammar patterns appropriate for ${level} level
- Use conjugations, particles, or sentence structures at this level
- Provide clear context for the grammar point` : ""}

${args.questionType === "reading" ? `
For READING questions:
- Provide a short passage (2-3 sentences) at ${level} level
- Ask a comprehension question about the passage
- Test understanding of main ideas or details` : ""}

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

    const response = await callOpenRouter(prompt, systemPrompt, DEFAULT_MODEL, 500, true);

    try {
      const parsed = JSON.parse(response) as {
        question: string;
        questionTranslation: string;
        options: string[];
        correctAnswer: string;
      };

      // Validate that correctAnswer is in options
      if (!parsed.options.includes(parsed.correctAnswer)) {
        // Try to find a close match
        const match = parsed.options.find(o =>
          o.toLowerCase().includes(parsed.correctAnswer.toLowerCase()) ||
          parsed.correctAnswer.toLowerCase().includes(o.toLowerCase())
        );
        if (match) {
          parsed.correctAnswer = match;
        } else {
          // Replace first option with correct answer as fallback
          parsed.options[0] = parsed.correctAnswer;
        }
      }

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
    } catch (error) {
      console.error("Failed to parse placement question:", response);
      throw new Error("Failed to generate placement question: Invalid AI response format");
    }
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
  handler: async (ctx, args): Promise<{
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

    if (
      test.questionsAnswered >= MIN_QUESTIONS &&
      test.abilityStandardError < SE_THRESHOLD
    ) {
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
      "vocabulary", "grammar", "reading", "vocabulary", "grammar",
    ];
    const suggestedType = typeCycle[test.questionsAnswered % typeCycle.length];

    return {
      targetDifficulty: clampedDifficulty,
      suggestedType,
      shouldContinue: true,
    };
  },
});
